import re
import os

# Files to process
files = [
    "frontend/index.html",
    "frontend/js/app.js",
    "frontend/plantillas/plantilla-analisis-fallos.html",
    "guia.md",
    "guia_reporte_proyecto.md",
    "README.md"
]

# Regex pattern for emojis and other common pictographs
# This includes characters in the range U+1F000 - U+1FFFF (most emojis),
# U+2600 - U+27BF (symbols like star, warning, gear, lightning),
# and various other blocks.
emoji_pattern = re.compile(
    r"[\U00010000-\U0010FFFF]|"  # Supplementary planes (emojis, etc.)
    r"[\u2600-\u27BF]|"          # Misc symbols & dingbats (lightning, gear, etc.)
    r"[\u2300-\u23FF]|"          # Misc technical
    r"[\u2b50\u2b06\u21bb\u2934\u2935]" # Specific arrow and star symbols
)

for file_path in files:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
        
    print(f"Processing: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Replace emojis with empty string
    new_content = emoji_pattern.sub("", content)
    
    # Let's perform some cleanups of resulting double spaces or leading spaces
    # specifically around headers or lists where emojis were removed
    # e.g. "## 🖥️ Estructura" -> "##  Estructura" -> "## Estructura"
    new_content = re.sub(r'#\s+', '# ', new_content)
    new_content = re.sub(r'\*\s+', '* ', new_content)
    new_content = re.sub(r'-\s+', '- ', new_content)
    
    # Save the modified file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

print("Emoji stripping complete!")
