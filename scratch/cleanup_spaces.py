import re
import os

files = [
    "frontend/index.html",
    "frontend/js/app.js",
    "frontend/plantillas/plantilla-analisis-fallos.html",
    "guia.md",
    "guia_reporte_proyecto.md",
    "README.md"
]

for file_path in files:
    if not os.path.exists(file_path):
        continue
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Remove Variation Selector-16 (U+FEOF) which is sometimes left over from emojis
    content = content.replace("\ufe0f", "")
    
    # Remove leading spaces inside common tags
    content = re.sub(r'<span>\s+', '<span>', content)
    content = re.sub(r'<h1>\s+', '<h1>', content)
    content = re.sub(r'<td>\s+', '<td>', content)
    content = re.sub(r'<th>\s+', '<th>', content)
    content = re.sub(r'<strong>\s+', '<strong>', content)
    content = re.sub(r'<label([^>]*)>\s+', r'<label\1>', content)
    content = re.sub(r'<button([^>]*)>\s+', r'<button\1>', content)
    
    # Also clean up double spaces inside text (but avoid touching code indentation)
    # A simple way is to replace double spaces in lines that don't start with space indentation
    lines = content.splitlines()
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            # If it's a markdown heading or list item, fix spaces
            if stripped.startswith('#') or stripped.startswith('*') or stripped.startswith('-'):
                # e.g., "##  Heading" -> "## Heading"
                cleaned = re.sub(r'^(#+)\s+', r'\1 ', stripped)
                cleaned = re.sub(r'^([\*\-])\s+', r'\1 ', cleaned)
                # Keep original indentation
                indent = line[:len(line) - len(line.lstrip())]
                line = indent + cleaned
            else:
                # Remove duplicate spaces except leading indent
                indent = line[:len(line) - len(line.lstrip())]
                cleaned = re.sub(r'\s+', ' ', stripped)
                line = indent + cleaned
        cleaned_lines.append(line)
        
    content = "\n".join(cleaned_lines) + "\n"
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Formatting cleanup complete!")
