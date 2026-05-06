# SciPaper Todo Manual Regression Checklist

Run this checklist before publishing a user-facing release.

## 1. Small Paper Core Path
- Start the app and confirm the first screen is Home, not a stale article route.
- Create a new small paper from the library or sidebar.
- Open the paper and edit title, target journal, status, and research context.
- Import a partial manuscript from Word/PDF/text through the manuscript import entry, then confirm sections land in the expected tabs.
- Use AI reformat/cleanup on imported text and confirm the cleaned text can be imported separately from image/file attachment import.
- Open a text section, enter writing mode, type text, exit to preview, and confirm the saved text remains visible.
- Add, edit, and delete a citation.
- Add, edit, and delete a Daily Log/progress entry.
- Export Markdown, DOCX, LaTeX, HTML, JSON, and share package where available.

## 2. Review Workflow
- Open the Review tab of a small paper.
- Add one review round manually.
- Add multiple comments under the same reviewer and confirm they remain separate comments.
- Import a review letter and confirm reviewer groups/comments are split sensibly.
- Edit reviewer, comment text, type, suggested section, and status.
- Add a revision response and mark a comment completed.
- Delete a single comment, then delete a whole review round.

## 3. Big Thesis Workflow
- Create a big thesis from the thesis entry point.
- Edit thesis metadata and clear optional fields.
- Link at least one small paper, open it from the thesis detail, then unlink it.
- Add, edit, and delete thesis section text.
- Export thesis Markdown and confirm chapter text is present.
- Delete the thesis and confirm linked small papers remain.

## 4. AI Provider and Tool Safety
- Add an AI provider with an API key and confirm it becomes active automatically.
- Confirm the default temperature is `0`.
- With auto-approve off, trigger a write tool and confirm approval is required.
- With auto-approve on, trigger a low-risk write tool and confirm it executes without the approval dialog.

## 5. Data Safety
- Open Settings > 本地数据目录 and confirm the displayed path is correct.
- Open the data directory from Settings.
- Export a full backup and confirm a `.scipaper-backup.json` file is created.
- Restore from that backup in a disposable test profile and confirm articles, thesis records, and attachments return.

## 6. Smoke Criteria
- No blank screen.
- No missing edit/delete controls for user-created objects.
- No ambiguous import entry between manuscript/review import and image/file attachment import.
- No stuck loading state after a failed operation.
- No data loss after backup/restore rehearsal.
