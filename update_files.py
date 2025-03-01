import os
import re

# Define the directory to search
directory = '/e:/workspace/yac.com.tw'

# Define the table tag to search for
table_tag = '<table width="1002" border="0" align="center" cellpadding="0" cellspacing="0">'

# Define the div to add
div_tag = '<div id="navigation-placeholder"></div>'

# Define the tr elements to remove
tr_elements_to_remove = [
    '<tr>\n            <td height="36" align="center">\n                <hr />\n            </td>\n        </tr>',
    '<tr>\n            <td align="center">\n                <table cellpadding="0" cellspacing="0">',
    '<tr>\n            <td height="36" align="center">\n                <hr />\n            </td>\n        </tr>',
    '<tr>\n            <td height="120" align="center" valign="top">\n                <table width="632" border="0" cellpadding="0" cellspacing="0">'
]

# Function to update files
def update_files(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if table_tag in content:
                    # Add the div above the table tag
                    content = content.replace(table_tag, div_tag + '\n' + table_tag)
                    
                    # Remove the specified tr elements
                    for tr in tr_elements_to_remove:
                        content = content.replace(tr, '')
                    
                    # Write the updated content back to the file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)

# Run the update function
update_files(directory)
