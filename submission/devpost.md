# Waypin

**Elevator pitch**

Turn private field photos into accessibility findings and a facilities handoff that traces each action back to evidence.

## What it does

A neighborhood arts center can have a usable entrance on paper and a blocked ramp on event day. Waypin gives volunteer auditors a place to record the difference. They document what they see, review and pin each finding to the route, and share a brief with the people responsible for clearing or repairing the route.

## How we built it

Waypin uses Firebase AI Logic to run Gemini Nano for private photo observations on supported desktop Chrome. The same SDK uses Gemini in the cloud to draft a work brief from the reviewed station, category, condition, measurement, and finding ID. A quick brief prefers the device model and can fall back to the cloud with the same visible payload. App Check protects cloud inference. IndexedDB and a service worker keep the field workspace usable offline after setup.

## What we learned

The same audit needs two different inference rules. Photos belong on the device because they can capture people and unrelated details. Concise, reviewed observations carry enough information to write a useful handoff. Requiring a source ID for each action makes the draft easier to verify before sharing.

## Quota application description

Waypin is a Chrome field audit workspace for volunteers documenting accessibility barriers at community venues. It uses Firebase AI Logic and Gemini Nano to review photos on the device, then sends only approved finding fields to Gemini in the cloud to draft a facilities handoff. Extra quota would let us evaluate Gemini image generation for varied fictional training and demo scenarios without using real venue photos.

## Demo cue sheet

| Time | Show |
| --- | --- |
| 0:00–0:20 | Open the landing page, point to the blocked ramp, and launch the audit. |
| 0:20–1:05 | Switch offline after model setup, run Nano on a sample photo, review the result, and save the finding. Show the SDK source label. |
| 1:05–1:50 | Reconnect, inspect the exact outgoing fields, then generate the facilities brief. |
| 1:50–2:20 | Read one action and its finding ID, edit the handoff, and open print preview. |
| 2:20–2:35 | Show the public repo and the Chrome setup needed for device inference. |

Record the live model calls before using this cue sheet for the official video. Any sample replay footage should retain its sample label.
