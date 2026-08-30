
with open('job_dashboard/web.py', 'r') as f:
    lines = f.readlines()

# Find the problematic section
for i in range(len(lines)):
    if 'except ImportError:' in lines[i]:
        # Check the next few lines
        if i+3 < len(lines) and 'return' in lines[i+3]:
            # Find the unconditional code after the return
            for j in range(i+4, min(i+20, len(lines))):
                if 'query = parse_qs' in lines[j]:
                    # This is the unconditional code that should be inside an if statement
                    # Insert the condition before this line
                    lines.insert(j, '            if path == "/api/jobs":\n')
                    # Indent the next few lines
                    for k in range(j+1, min(j+10, len(lines))):
                        if lines[k].strip() and not lines[k].startswith('            '):
                            # This line is part of the /api/jobs handler
                            lines[k] = '            ' + lines[k]
                        else:
                            # We've reached the end of this block
                            break
                    break

# Write the fixed file
with open('job_dashboard/web.py', 'w') as f:
    f.writelines(lines)

print("Fixed /api/jobs endpoint")