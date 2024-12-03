use kill_tree::{blocking::kill_tree_with_config, Config};
use lazy_static::lazy_static;
use std::sync::Mutex;

// Singleton that will store process IDs for spawned child processes implementing agent tasks.
lazy_static! {
    static ref PROCESS_STORE: Mutex<Vec<u32>> = Mutex::new(Vec::new());
}

pub fn store_process(pid: u32) {
    let mut store = PROCESS_STORE.lock().unwrap();
    store.push(pid);
}

// This removes the record of a process from the store, it does not kill it or check that it is dead.
pub fn remove_process(pid: u32) -> bool {
    let mut store = PROCESS_STORE.lock().unwrap();
    if let Some(index) = store.iter().position(|&x| x == pid) {
        store.remove(index);
        true
    } else {
        false
    }
}

/// Kill all stored processes
pub fn kill_processes() {
    let mut killed_processes = Vec::new();
    {
        let store = PROCESS_STORE.lock().unwrap();
        for &pid in store.iter() {
            let config = Config {
                signal: "SIGKILL".to_string(),
                ..Default::default()
            };
            let outputs = match kill_tree_with_config(pid, &config) {
                Ok(outputs) => outputs,
                Err(e) => {
                    eprintln!("Failed to kill process {}: {}", pid, e);
                    continue;
                }
            };
            for output in outputs {
                match output {
                    kill_tree::Output::Killed { process_id, .. } => {
                        killed_processes.push(process_id);
                    }
                    kill_tree::Output::MaybeAlreadyTerminated { process_id, .. } => {
                        killed_processes.push(process_id);
                    }
                }
            }
        }
    }
    // Clean up the store
    for pid in killed_processes {
        remove_process(pid);
    }
}
