import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Service Role Key in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const BOOKS_DIR = path.resolve(process.cwd(), "storage/books/book summaries");

async function main() {
    console.log("Starting book import...");

    // 1. Get a user to assign books to
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (userError || !users || users.length === 0) {
        console.error("Failed to find any users to assign books to.", userError);
        process.exit(1);
    }

    const userId = users[0].id;
    console.log(`Assigning books to user: ${users[0].email} (${userId})`);

    // 2. Read files
    let files;
    try {
        files = await fs.readdir(BOOKS_DIR);
    } catch (err) {
        console.error(`Error reading directory ${BOOKS_DIR}:`, err);
        process.exit(1);
    }

    const txtFiles = files.filter((f) => f.endsWith(".txt"));
    console.log(`Found ${txtFiles.length} text files.`);

    // 3. Process each file
    for (const file of txtFiles) {
        const filePath = path.join(BOOKS_DIR, file);

        // Clean filename to get title
        // Remove _SUMMARY, .txt, (1), etc.
        let title = file
            .replace(/_SUMMARY(?:\(\d+\))?\.txt$/, "") // Remove _SUMMARY and any (N) suffix
            .replace(/\.txt$/, "") // Remove .txt extension
            .replace(/_/g, " ") // Replace underscores with spaces
            .trim();

        // Remove any remaining (N) at the end of title if it wasn't caught
        title = title.replace(/\(\d+\)$/, "").trim();

        // Handle double extension if present (e.g. .txt.txt)
        title = title.replace(/\.txt$/, "").trim();

        console.log(`Processing: "${file}" -> Title: "${title}"`);

        try {
            const content = await fs.readFile(filePath, "utf-8");

            if (!content.trim()) {
                console.warn(`Skipping empty file: ${file}`);
                continue;
            }

            // 4. Insert into database
            const { error: insertError } = await supabase.from("books").insert({
                user_id: userId,
                title: title,
                author: "Unknown", // Filenames don't strictly follow Author - Title format, so default to Unknown or try to parse?
                // Many filenames are just title. Some might have "By Author".
                // Simple heuristic: check for " By " in title?
                summary: {
                    raw_text: content,
                },
                local_file_path: filePath,
                is_public: true, // Make them viewable in discovery
                progress_percent: 0,
            });

            if (insertError) {
                console.error(`Failed to insert "${title}":`, insertError.message);
            } else {
                console.log(`Successfully imported: "${title}"`);
            }

        } catch (err) {
            console.error(`Error processing file ${file}:`, err);
        }
    }

    console.log("Import complete.");
}

main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
