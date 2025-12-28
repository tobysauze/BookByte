import * as JSZip from 'jszip';

export interface EpubMetadata {
  title: string;
  author: string;
  language?: string;
  publisher?: string;
  publicationDate?: string;
  description?: string;
}

export interface EpubChapter {
  title: string;
  content: string;
  order: number;
}

export interface EpubBook {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  fullText: string;
}

export async function parseEpubFile(file: File): Promise<EpubBook> {
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the EPUB file as a ZIP
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find and parse the OPF file
    const opfFiles = Object.keys(zip.files).filter(name => name.endsWith('.opf'));
    if (opfFiles.length === 0) {
      throw new Error('No OPF file found in EPUB');
    }
    
    const opfContent = await zip.file(opfFiles[0])?.async('text');
    if (!opfContent) {
      throw new Error('Could not read OPF file');
    }
    
    // Parse metadata from OPF
    const metadata = parseOpfMetadata(opfContent);
    
    // Find content files - be more inclusive
    const contentFiles = Object.keys(zip.files).filter(name => 
      (name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm') || name.endsWith('.xml')) &&
      !name.includes('META-INF') &&
      !name.includes('toc.ncx') &&
      !name.endsWith('.opf') &&
      !name.endsWith('.css') &&
      !name.endsWith('.jpg') &&
      !name.endsWith('.jpeg') &&
      !name.endsWith('.png') &&
      !name.endsWith('.gif') &&
      !name.endsWith('.svg')
    );
    
    console.log(`Found ${contentFiles.length} content files:`, contentFiles);
    
    // Extract chapters and content
    const chapters: EpubChapter[] = [];
    let fullText = '';

    for (let i = 0; i < contentFiles.length; i++) {
      const fileName = contentFiles[i];
      const file = zip.file(fileName);
      
      if (!file) continue;
      
      try {
        const content = await file.async('text');
        if (!content) continue;
        
        // Clean up the HTML content and extract text
        const textContent = cleanHtmlContent(content);
        
        if (textContent.trim()) {
          // Extract title from content or use filename
          const title = extractTitleFromContent(content) || 
                       fileName.split('/').pop()?.replace(/\.(html|xhtml|htm|xml)$/, '') || 
                       `Chapter ${i + 1}`;
          
          console.log(`Processing file ${fileName}: extracted title "${title}"`);
          
          chapters.push({
            title,
            content: textContent,
            order: i,
          });
          
          fullText += `\n\n${title}\n\n${textContent}`;
        }
      } catch (chapterError) {
        console.warn(`Error processing content file ${fileName}:`, chapterError);
        // Continue with other files
      }
    }

    return {
      metadata,
      chapters,
      fullText: fullText.trim(),
    };
  } catch (error) {
    console.error('Error parsing EPUB file:', error);
    throw new Error(`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseOpfMetadata(opfContent: string): EpubMetadata {
  // Simple XML parsing for metadata
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  const languageMatch = opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
  const publisherMatch = opfContent.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
  const dateMatch = opfContent.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
  const descriptionMatch = opfContent.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/i);

  return {
    title: titleMatch?.[1]?.trim() || 'Untitled',
    author: creatorMatch?.[1]?.trim() || 'Unknown Author',
    language: languageMatch?.[1]?.trim() || 'en',
    publisher: publisherMatch?.[1]?.trim(),
    publicationDate: dateMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim(),
  };
}

function extractTitleFromContent(content: string): string | null {
  // Try to extract title from HTML content
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  // Try to extract from h1 tag
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Try to extract from h2 tag (often used for sections)
  const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (h2Match) {
    return h2Match[1].trim();
  }
  
  // Try to extract from h3 tag
  const h3Match = content.match(/<h3[^>]*>([^<]+)<\/h3>/i);
  if (h3Match) {
    return h3Match[1].trim();
  }
  
  // Look for any heading tag
  const headingMatch = content.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  
  return null;
}

function cleanHtmlContent(html: string): string {
  // Remove HTML tags and decode entities more comprehensively
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '') // Remove noscript
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode ampersands
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotes
    .replace(/&#39;/g, "'") // Decode apostrophes
    .replace(/&apos;/g, "'") // Decode apostrophes (alternative)
    .replace(/&mdash;/g, '—') // Em dash
    .replace(/&ndash;/g, '–') // En dash
    .replace(/&hellip;/g, '…') // Ellipsis
    // Decode numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // Decode numeric entities (hex)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  return text;
}

export function isEpubFile(file: File): boolean {
  return file.type === 'application/epub+zip' || 
         file.name.toLowerCase().endsWith('.epub');
}
