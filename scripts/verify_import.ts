import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Service Role Key in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("Verifying imported books...");

    const { data: books, error } = await supabase
        .from("books")
        .select("id, title, created_at, is_public")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching books:", error);
        process.exit(1);
    }

    console.log(`Fetched ${books.length} recent books:`);
    books.forEach((book) => {
        console.log(`- [${book.id}] ${book.title} (Public: ${book.is_public})`);
    });
}

main().catch(console.error);
