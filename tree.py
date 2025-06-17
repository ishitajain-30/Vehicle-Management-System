import os
from pathlib import Path

def get_gitignore_patterns():
    """
    Read .gitignore file and return a set of patterns to exclude
    """
    gitignore_patterns = set()
    try:
        with open('.gitignore', 'r') as f:
            for line in f:
                # Remove comments and whitespace
                line = line.split('#')[0].strip()
                if line:
                    # Remove trailing slashes and add to set
                    gitignore_patterns.add(line.rstrip('/'))
    except FileNotFoundError:
        pass
    return gitignore_patterns

def generate_directory_tree(directory, prefix="", max_files_per_dir=15):
    """
    Generate the directory tree structure as a list of strings.
    
    Args:
        directory (str): The root directory to start from
        prefix (str): Prefix for the current line (used for indentation)
        max_files_per_dir (int): Maximum number of files to show per directory
    
    Returns:
        list: List of strings representing the directory tree
    """
    tree_output = []
    
    # Define directories to exclude
    exclude_dirs = {
        'node_modules', 'env', '.git', '__pycache__', 
        '.pytest_cache', 'dist', 'build', 'venv',
        '.venv', 'eggs', '.eggs', '.npm', '.yarn'
    }
    
    # Define important file patterns to always show
    important_files = {
        'package.json', 'requirements.txt', 'setup.py', 'main.py', 'main.js',
        'index.js', 'index.html', 'README.md', '.env.example', 'Dockerfile',
        'docker-compose.yml', '.gitignore', 'tsconfig.json', 'vite.config.js',
        'next.config.js', 'app.py', 'manage.py'
    }
    
    path = Path(directory)
    
    try:
        items = sorted(
            [item for item in path.iterdir() if not item.name.startswith('.')],
            key=lambda x: (x.is_file(), x.name.lower())
        )
    except PermissionError:
        return tree_output
    
    # Filter and sort items
    dirs = [item for item in items if item.is_dir() and item.name not in exclude_dirs]
    files = [item for item in items if item.is_file()]
    
    # Always show important files first
    important = [f for f in files if f.name in important_files]
    other_files = [f for f in files if f.name not in important_files]
    
    # Combine the lists with important files first
    filtered_items = dirs + important
    remaining_files = other_files
    
    # Show ellipsis if there are too many other files
    if len(remaining_files) > max_files_per_dir:
        remaining_files = remaining_files[:max_files_per_dir]
        show_ellipsis = True
    else:
        show_ellipsis = False
    
    filtered_items.extend(remaining_files)
    
    for i, item in enumerate(filtered_items):
        is_last = (i == len(filtered_items) - 1) and not show_ellipsis
        current_prefix = "└── " if is_last else "├── "
        tree_output.append(f"{prefix}{current_prefix}{item.name}")
        
        if item.is_dir():
            next_prefix = prefix + ("    " if is_last else "│   ")
            tree_output.extend(generate_directory_tree(item, next_prefix, max_files_per_dir))
    
    if show_ellipsis:
        tree_output.append(f"{prefix}└── ...")
    
    return tree_output

if __name__ == "__main__":
    # Get the current working directory
    root_dir = os.getcwd()
    
    # Generate the tree content
    tree_content = [os.path.basename(root_dir)]  # Start with root directory name
    tree_content.extend(generate_directory_tree(root_dir))
    
    # Write to file
    output_file = 'directory_tree.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(tree_content))
    
    print(f"Directory tree has been saved to {output_file}")