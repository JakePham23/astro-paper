import { buildSearchIndexResponse } from "@/utils/searchIndex";

export async function GET() {
  return buildSearchIndexResponse("en");
}
