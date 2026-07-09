// Audio environment shared down the visual tree without prop drilling — currently just
// the narration playback rate (voSpeed). Karaoke word timings are stored in RAW seconds;
// at playbackRate r a word starting at s is audible at s / r.
import { createContext } from "react";

export const AudioEnvContext = createContext<{ voSpeed: number }>({ voSpeed: 1 });
