// Poster thumbnail extraction for video sources/renders. Server-only.
import "server-only";
import { ffmpeg } from "./ffmpeg";

/** Extract the first frame of a video as a JPEG poster. */
export async function makePoster(absVideo: string, absOut: string): Promise<void> {
  await ffmpeg(["-i", absVideo, "-frames:v", "1", "-q:v", "3", absOut]);
}
