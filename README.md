# Toybox and Waypin

Toybox’s landing page has playable examples for games, videos, and songwriting. In the studio, pick one of eight genres or ask Gemini to write an entire instrumental for ten toy musicians. Play the song across its sections, change the notes, preview individual instruments, and export the complete mix as a WAV. Your arrangement is saved in this browser.

Firebase AI Logic generates a structured melody, section plan, and mixer edits. Toybox expands the plan into editable notes and synthesizes the sound with Web Audio. The cloud uses the Spark tier. Supported desktop Chrome devices can also arrange on-device with Gemini Nano.

[Open Toybox](https://manateek1.github.io/waypin/) · [Go directly to the studio](https://manateek1.github.io/waypin/studio/)

## Waypin field audit

Waypin helps community venue volunteers document accessibility barriers in the field and turn reviewed findings into a traceable facilities handoff.

[Open the audit demo](https://manateek1.github.io/waypin/audit/)

The public demo uses a fictional venue and generated photos. On compatible desktop Chrome, Waypin calls the browser’s built-in Gemini Nano for live photo observations and quick briefs. It works with an initial model download and then can run offline. Other browsers can use manual review, reports, and the labeled sample replay. A separate Firebase configuration enables the cloud modes.

## How inference works

| Task | Firebase AI Logic mode | Input |
| --- | --- | --- |
| Photo observation | Chrome Prompt API or `ONLY_ON_DEVICE` | JPEG and a bounded observation prompt |
| Quick handoff | Chrome Prompt API or `PREFER_ON_DEVICE` | Reviewed station, category, condition, and optional measurement |
| Full handoff | `ONLY_IN_CLOUD` | The same reviewed fields and finding IDs |

The UI identifies on-device results and reads the Firebase response’s inference source for Firebase runs. Uploaded images are re-encoded in the browser and saved with the audit in IndexedDB. The brief preview lists every finding field used in the request. Photo bytes, venue names, private notes, and field verification notes are excluded from brief prompts. Generated actions must reference each finding exactly once. All observations and brief text remain editable.

## Run locally

```sh
npm ci
npm run dev
```

Visit the displayed URL. Chrome's on-device mode and sample replay work without cloud credentials. A production build adds the offline cache:

```sh
npm run build
npm run preview
```

## Configure live Firebase inference

1. Create a Firebase Spark project, register its web app, and enable AI Logic with the Gemini Developer API.
2. Register the hosted domain with reCAPTCHA Enterprise, configure the web app in Firebase App Check, and verify enforcement for Firebase AI Logic.
3. Copy `.env.example` to `.env.local`. Use the project’s Firebase web app configuration and public reCAPTCHA site key. Keep service credentials and debug tokens out of the repository. To test the cloud from a private dev server, set `VITE_FIREBASE_APPCHECK_DEBUG=true` and register the browser’s debug token in the Firebase console.
4. Build and deploy from this directory with `npx firebase-tools@15.37.0 deploy --only hosting --project YOUR_PROJECT_ID`.
5. For device inference, use a compatible Chrome desktop installation with the multimodal Nano flag enabled where required. Open a finding and click **Analyze on device** to initialize Nano. Wait for the initial model download before going offline.

[Firebase web hybrid inference setup](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) · [App Check setup](https://firebase.google.com/docs/ai-logic/app-check)

For the GitHub Pages deployment, set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` as repository Actions variables and run the **Build Waypin** workflow. These are public web client identifiers. Register the deployed hostname with the App Check provider. Gemini API keys, service account credentials, and App Check debug tokens belong outside the web build.

## Judge walkthrough

1. Open the sample audit and select **Main entrance**.
2. Open **Review finding** to see the photo and editable observations. On supported desktop Chrome, use **Analyze on device** and review the resulting observation before saving.
3. Choose **Build handoff**, then expand the exact payload. Use **Generate on device** on supported desktop Chrome or **Open sample replay** on other browsers.
4. Edit the brief and choose **Print or save brief as PDF**.

Use **My audits** to switch between saved venues or add a fresh fictional sample. Starting a new audit keeps the previous audit and its evidence in this browser. In a brief, **View evidence** opens the finding behind that action. When exporting, turn on **Include evidence photos** only for copies where the recipient should see them.

Waypin surfaces observations and follow-up questions for human review. It does not determine whether a venue meets accessibility standards.

## Assets

Venue images and site plan were generated for the fictional Marigold Arts Center with the built-in image generation tool. Geist and Barlow Condensed are distributed under the SIL Open Font License. Icons use Lucide and its ISC license.
