import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const alt = "Book summary on BookByte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: book } = await supabase
    .from("books")
    .select("title, author, cover_url, category, word_count")
    .eq("id", id)
    .single();

  if (!book) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1e1b4b",
            color: "white",
            fontSize: "32px",
          }}
        >
          BookByte
        </div>
      ),
      size,
    );
  }

  const readTime = book.word_count
    ? `${Math.ceil(book.word_count / 250)} min read`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: book.cover_url ? "40px" : "0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "20px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.8)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {book.category || "Book Summary"}
              </div>
              {readTime && (
                <div
                  style={{
                    marginLeft: "12px",
                    fontSize: "14px",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {readTime}
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: book.title.length > 40 ? "36px" : "48px",
                fontWeight: 700,
                color: "white",
                lineHeight: 1.2,
                marginBottom: "16px",
              }}
            >
              {book.title.length > 80
                ? book.title.slice(0, 80) + "…"
                : book.title}
            </div>

            {book.author && (
              <div style={{ fontSize: "22px", color: "rgba(255,255,255,0.7)" }}>
                by {book.author}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: "white",
              }}
            >
              B
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              BookByte
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "rgba(255,255,255,0.5)",
                marginLeft: "8px",
              }}
            >
              AI-Powered Book Summaries
            </div>
          </div>
        </div>

        {book.cover_url && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={book.cover_url}
              alt=""
              width={280}
              height={420}
              style={{
                borderRadius: "12px",
                objectFit: "cover",
                boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        )}
      </div>
    ),
    size,
  );
}
