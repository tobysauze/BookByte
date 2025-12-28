# Book Storage Directory

This directory contains the original book files uploaded to BookByte for additional analysis and verification purposes.

## Directory Structure

```
storage/
└── books/
    ├── pdf/          # PDF files
    ├── epub/         # EPUB files  
    ├── txt/          # Plain text files
    └── md/           # Markdown files
```

## File Naming Convention

Files are stored with the following naming pattern:
```
{timestamp}-{sanitized-original-filename}
```

Example: `1703123456789-The_4_Hour_Body.pdf`

## Purpose

These original files are used for:

1. **Completeness Analysis** - Verify that our AI-generated summaries capture all major concepts
2. **Comprehensive Analysis** - Run multi-pass analysis on the complete original text
3. **Comparison Analysis** - Generate fresh summaries and compare with existing ones
4. **Quality Assurance** - Ensure our summarization process is thorough and accurate

## Security

- Files are stored locally on the server
- Access is restricted to book owners only
- Files are not publicly accessible via web URLs
- Original files are preserved for analysis purposes only

## Database Integration

The `books` table includes:
- `local_file_path` - Path to the stored original file
- `analysis_results` - JSON data from analysis operations
- `last_analyzed_at` - Timestamp of last analysis

## Maintenance

- Files are automatically organized by type
- Consider implementing cleanup policies for old files if needed
- Monitor disk usage as the collection grows






