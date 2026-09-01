import zipfile
import os
import shutil

def zip_dir(src_path, zip_filename, exclude_dirs=None, exclude_files=None):
    if exclude_dirs is None:
        exclude_dirs = []
    if exclude_files is None:
        exclude_files = []
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(src_path):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.git')]
            for file in files:
                if file.endswith('.zip') or file in exclude_files:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, src_path)
                zipf.write(file_path, arcname)

if __name__ == '__main__':
    print('Generating production Netlify deployment archives...')
    
    # 1. Package pre-built dist folder (for 1-click Netlify Drop deployment)
    # Exclude server.cjs and server.cjs.map from the client zip to prevent any Netlify Drop static parser issues
    if os.path.exists('dist'):
        zip_dir(
            'dist',
            'dist.zip',
            exclude_files=['server.cjs', 'server.cjs.map']
        )
        zip_dir(
            'dist',
            'ZENET-HUB-NETLIFY-DROP.zip',
            exclude_files=['server.cjs', 'server.cjs.map']
        )
        print('Created dist.zip and ZENET-HUB-NETLIFY-DROP.zip (Ready for 1-click Netlify Drop / manual upload)')
    
    # 2. Package complete source code with Netlify config (for GitHub / Netlify Git build)
    zip_dir(
        '.',
        'zenet-hub-pwa.zip',
        exclude_dirs=['node_modules', '.git', 'dist', '.system_generated', '__pycache__'],
        exclude_files=['dist.zip', 'zenet-hub-pwa.zip', 'ZENET-HUB-NETLIFY-DROP.zip', 'zenet-hub-source.zip']
    )
    zip_dir(
        '.',
        'zenet-hub-source.zip',
        exclude_dirs=['node_modules', '.git', 'dist', '.system_generated', '__pycache__'],
        exclude_files=['dist.zip', 'zenet-hub-pwa.zip', 'ZENET-HUB-NETLIFY-DROP.zip', 'zenet-hub-source.zip']
    )
    print('Created zenet-hub-pwa.zip & zenet-hub-source.zip (Full Source Code for Netlify Git deployment)')

