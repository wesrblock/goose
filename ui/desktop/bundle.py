#!/usr/bin/env python3
import re
from pathlib import Path
from typing import Dict, Union

def replace_env_macro(provider_type: str, host: str, model: str) -> bool:
    """
    Replace content between environment macro markers with formatted environment variables.
    
    Args:
        provider_type (str): The type of provider (e.g., 'databricks')
        host (str): The host URL
        model (str): The model name
            
    Returns:
        bool: True if successful, False otherwise
    """
    file_path = './src/main.ts'

    try:
        # Read the file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Format the environment variables
        formatted_vars = [
            f"        process.env.GOOSE_PROVIDER__TYPE = '{provider_type}';",
            f"        process.env.GOOSE_PROVIDER__HOST = '{host}';",
            f"        process.env.GOOSE_PROVIDER__MODEL = '{model}';"
        ]
        
        replacement_content = "\n".join(formatted_vars)
        replacement_content += "\n        return true;"
        
        # Define the pattern to match content between markers
        pattern = r'//{env-macro-start}//.*?//{env-macro-end}//'
        flags = re.DOTALL  # Allow matching across multiple lines
        
        # Create the replacement string with the markers and new content
        replacement = f"//{{env-macro-start}}//\n{replacement_content}\n//{{env-macro-end}}//"
        
        # Perform the replacement
        new_content, count = re.subn(pattern, replacement, content, flags=flags)
        
        if count == 0:
            print(f"Error: Could not find macro markers in {file_path}")
            return False
            
        # Write the modified content back to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"Successfully updated {file_path}")
        return True
        
    except Exception as e:
        print(f"Error processing file {file_path}: {str(e)}")
        return False

# Example usage
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Update environment variables in main.ts')
    parser.add_argument('--type', required=True, help='Provider type (e.g., databricks)')
    parser.add_argument('--host', required=True, help='Host URL')
    parser.add_argument('--model', required=True, help='Model name')
    
    args = parser.parse_args()
    
    success = replace_env_macro(
        provider_type=args.type,
        host=args.host,
        model=args.model
    )
    
    if not success:
        print("Failed to update environment variables")
        exit(1)