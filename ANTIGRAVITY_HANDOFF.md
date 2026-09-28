# Instructions for the Antigravity agent (image generation)

You are the **image generator** for DISC RIOT 2084, a Windjammers-style arcade game. A separate Claude session is the **creative director**. It writes prompts and reviews every image. You do not judge final quality or edit game code. You generate exactly what the queue asks for and push it.

## Your loop
1. `git pull`
2. Open the newest file in `tools/gen-assets/queue/` whose header says `STATUS: READY`.
3. For **each job** in that file:
   - Generate the image with **Nano Banana** (the Gemini image model). Use the model named in the job (Nano Banana Pro = `gemini-3-pro-image`; Nano Banana 2 = `gemini-3.1-flash-image`).
   - Use the **exact prompt text** in the job's code block. Do not rewrite, shorten or "improve" it.
   - Use the aspect ratio and resolution given. If the job lists `refs:`, attach those image files from the repo as reference images.
   - Generate the number of **variants** requested (default 2), and save each one as PNG at `<output path>_v1.png`, `_v2.png` and so on.
   - Save exactly at the path given, and create the folders if needed.
   - If generation is refused or fails, write the reason into `tools/gen-assets/queue/<batch>_log.md` and move on.
4. Change the batch header to `STATUS: GENERATED`, then add a short log file `tools/gen-assets/queue/<batch>_log.md`. It lists every file written, the model actually used, and anything that went wrong.
5. `git add tools/gen-assets && git commit -m "art: <batch> generated" && git push`

## Flow mode (use when the API quota is exhausted)
If image generation through your API/tool quota fails, generate through **Google Flow** (labs.google/flow) in the browser, which is already signed in:
1. Open Flow and use its image generation with **Nano Banana 2** (or Pro if the job asks and it's offered).
2. For each job: upload the job's `refs:` image as a reference/ingredient, paste the job's prompt **exactly**, set the aspect ratio, and generate.
3. Download the result at the **highest resolution offered**, as PNG if available. Save it to the job's output path with the `_v1`/`_v2` suffix. If Flow only gives JPG/WebP, keep that extension; the pipeline accepts it.
4. Work at a steady, human pace (one job at a time). Don't run parallel tabs.
5. At the top of the log, write `Generated via Google Flow`, plus the resolution you were able to download.

## Video jobs (queue files named `videoNN.md`)
Same loop, but use Flow's **video** generation in **image-to-video** mode: upload the job's `start:` image as the first frame, pick 16:9 landscape and the shortest duration, paste the prompt exactly, and save the MP4 to the job's output path (or into the inbox, named by job number).

## Inbox (manual fallback)
If files can't be named and placed per job, just drop every downloaded image into `tools/gen-assets/inbox/<batch>/` with any filenames and push. The director will identify and sort them.

## Rules
- **Use the exact model and resolution each job names.** If that model isn't available to you, say so at the top of the log instead of silently substituting (batch01 came back as Nano Banana 2 at 1K instead of Pro at 2K).
- Batches can be large. If you hit a quota limit, push what you have, set `STATUS: PARTIAL`, and list the remaining job numbers in the log. The next run resumes from there.
- **Never** modify files outside `tools/gen-assets/raw/`, `tools/gen-assets/inbox/` and `tools/gen-assets/queue/`.
- Save full-resolution PNGs. Don't compress them, convert to JPEG or resize.
- Don't remove or alter the green background. The director's pipeline does the keying.
- Don't generate anything that isn't in the queue.
- All characters are adults (25+). Content is non-explicit sports glamour.
