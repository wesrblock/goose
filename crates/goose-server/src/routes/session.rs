use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{fs, path::PathBuf};

// Request/Response types
#[derive(Debug, Deserialize, Serialize)]
struct LoadSessionRequest {
    session_id: String,
    session_dir: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct SaveSessionRequest {
    session_id: String,
    session_dir: String,
    content: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct ListSessionsRequest {
    session_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoadSessionResponse {
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListSessionsResponse {
    sessions: Vec<String>,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

// Helper function to validate and create session directory
fn ensure_session_dir(dir_path: &str) -> Result<PathBuf, anyhow::Error> {
    let path = PathBuf::from(dir_path);
    
    // Basic path validation to prevent directory traversal
    if path.components().any(|c| c.as_os_str() == "..") {
        return Err(anyhow::anyhow!("Invalid session directory path"));
    }

    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    Ok(path)
}

// Handlers
async fn load_session(Json(request): Json<LoadSessionRequest>) -> impl IntoResponse {
    let session_dir = match ensure_session_dir(&request.session_dir) {
        Ok(dir) => dir,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid session directory: {}", e),
                }),
            )
                .into_response()
        }
    };

    let session_file = session_dir.join(format!("{}.jsonl", request.session_id));

    if !session_file.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Session '{}' not found", request.session_id),
            }),
        )
            .into_response();
    }

    match fs::read_to_string(&session_file) {
        Ok(content) => (
            StatusCode::OK,
            Json(LoadSessionResponse { content }),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to read session file: {}", e),
            }),
        )
            .into_response(),
    }
}

async fn save_session(Json(request): Json<SaveSessionRequest>) -> impl IntoResponse {
    let session_dir = match ensure_session_dir(&request.session_dir) {
        Ok(dir) => dir,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid session directory: {}", e),
                }),
            )
                .into_response()
        }
    };

    let session_file = session_dir.join(format!("{}.jsonl", request.session_id));

    match fs::write(&session_file, request.content) {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({ "status": "success" }))
        ).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to save session: {}", e),
            }),
        )
            .into_response(),
    }
}

async fn list_sessions(Json(request): Json<ListSessionsRequest>) -> impl IntoResponse {
    let session_dir = match ensure_session_dir(&request.session_dir) {
        Ok(dir) => dir,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Invalid session directory: {}", e),
                }),
            )
                .into_response()
        }
    };

    match fs::read_dir(&session_dir) {
        Ok(entries) => {
            let sessions: Vec<String> = entries
                .filter_map(|entry| {
                    entry.ok().and_then(|e| {
                        e.path()
                            .file_stem()
                            .and_then(|n| n.to_str())
                            .map(String::from)
                    })
                })
                .collect();

            (StatusCode::OK, Json(ListSessionsResponse { sessions })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to list sessions: {}", e),
            }),
        )
            .into_response(),
    }
}

// Configure routes for this module
pub fn routes() -> Router {
    Router::new()
        .route("/session/load", post(load_session))
        .route("/session/save", post(save_session))
        .route("/session/list", post(list_sessions))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tempfile::tempdir;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_session_endpoints() {
        // Create a temporary directory for session files
        let temp_dir = tempdir().unwrap();
        let temp_dir_path = temp_dir.path().to_str().unwrap().to_string();

        // Build router
        let app = routes();

        // Test list sessions (empty)
        let request = Request::builder()
            .uri("/session/list")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&ListSessionsRequest {
                    session_dir: temp_dir_path.clone(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Test save session
        let save_request = Request::builder()
            .uri("/session/save")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&SaveSessionRequest {
                    session_id: "test-session".to_string(),
                    session_dir: temp_dir_path.clone(),
                    content: "{\"type\":\"test\"}\n".to_string(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(save_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Test load session
        let load_request = Request::builder()
            .uri("/session/load")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&LoadSessionRequest {
                    session_id: "test-session".to_string(),
                    session_dir: temp_dir_path.clone(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(load_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Test list sessions (now with one session)
        let request = Request::builder()
            .uri("/session/list")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&ListSessionsRequest {
                    session_dir: temp_dir_path.clone(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Verify response body contains our test session
        let body = body::to_bytes(response.into_body()).await.unwrap();
        let response: ListSessionsResponse = serde_json::from_slice(&body).unwrap();
        assert!(response.sessions.contains(&"test-session".to_string()));
    }

    #[tokio::test]
    async fn test_load_nonexistent_session() {
        let temp_dir = tempdir().unwrap();
        let temp_dir_path = temp_dir.path().to_str().unwrap().to_string();
        let app = routes();

        let load_request = Request::builder()
            .uri("/session/load")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&LoadSessionRequest {
                    session_id: "nonexistent".to_string(),
                    session_dir: temp_dir_path,
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.oneshot(load_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_save_and_load_session_content() {
        let temp_dir = tempdir().unwrap();
        let temp_dir_path = temp_dir.path().to_str().unwrap().to_string();
        let app = routes();

        // Test content to save
        let test_content = "{\"message\":\"test content\"}\n{\"message\":\"more content\"}\n";

        // Save session
        let save_request = Request::builder()
            .uri("/session/save")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&SaveSessionRequest {
                    session_id: "test-content".to_string(),
                    session_dir: temp_dir_path.clone(),
                    content: test_content.to_string(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(save_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Load and verify content
        let load_request = Request::builder()
            .uri("/session/load")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&LoadSessionRequest {
                    session_id: "test-content".to_string(),
                    session_dir: temp_dir_path,
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(load_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = body::to_bytes(response.into_body()).await.unwrap();
        let response: LoadSessionResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(response.content, test_content);
    }

    #[tokio::test]
    async fn test_invalid_session_directory() {
        let app = routes();

        // Test with invalid path containing directory traversal
        let request = Request::builder()
            .uri("/session/list")
            .method("POST")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_string(&ListSessionsRequest {
                    session_dir: "../invalid/path".to_string(),
                })
                .unwrap(),
            ))
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}