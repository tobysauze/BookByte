export function calculateBookMetadata(summary: any) {
    const isRawText = summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as any).raw_text === 'string';
    const rawText = isRawText ? (summary as { raw_text: string }).raw_text : null;
    const quickSummary = summary?.quick_summary;
    const shortSummary = summary?.short_summary;

    // 1. Determine Description
    let description = 'No description available.';
    if (shortSummary && shortSummary.length > 0) {
        description = shortSummary;
    } else if (quickSummary && quickSummary.length > 0) {
        description = quickSummary.substring(0, 200) + (quickSummary.length > 200 ? '...' : '');
    } else if (rawText && rawText.length > 0) {
        description = rawText.substring(0, 200) + (rawText.length > 200 ? '...' : '');
    }

    // 2. Determine Word Count
    let wordCount = 0;
    if (rawText) {
        wordCount = rawText.trim().split(/\s+/).length;
    }

    // 3. Determine Category
    const textToAnalyze = (rawText || quickSummary || '').toLowerCase();
    let category = 'Non-Fiction';

    if (textToAnalyze.includes('psychology') || textToAnalyze.includes('mind') || textToAnalyze.includes('consciousness')) {
        category = 'Psychology';
    } else if (textToAnalyze.includes('leadership') || textToAnalyze.includes('management') || textToAnalyze.includes('business')) {
        category = 'Management/Leadership';
    } else if (textToAnalyze.includes('productivity') || textToAnalyze.includes('workflow')) {
        category = 'Productivity';
    } else if (textToAnalyze.includes('self-help') || textToAnalyze.includes('personal development')) {
        category = 'Self-Help';
    }

    return { wordCount, description, category };
}
