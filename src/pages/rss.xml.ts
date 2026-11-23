import { buildRssResponse } from "@/utils/rssFeed";

export async function GET() {
  return buildRssResponse("vi");
}
