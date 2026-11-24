NLP + RAG Customer Enquiry and Lead Management  -  START HERE
==============================================================

FIRST TIME ONLY
  1. Double-click  setup.bat      (needs internet, wait until it says SETUP DONE)

EVERY TIME AFTER THAT
  - Double-click  run_app.bat     -> opens the working app in your browser
  - Double-click  run_tests.bat   -> checks everything still works (should say 10 passed)
  - Double-click  run_eval.bat    -> runs the Bitext evaluation, saves results in the "results" folder
                                     (put the Bitext CSV in the "data" folder once; it also looks in Downloads)

WHY THIS KEEPS WORKING
  - All package versions are locked in requirements.txt (nothing updates by itself).
  - It uses its own private Python environment (the ".venv" folder), so installing or
    updating other Python things on your PC cannot break it.
  - You can move or copy this whole folder anywhere; the .bat files find their own location.

KEEP IT SAFE
  - Copy the whole folder to a USB drive / Google Drive, or upload it to your GitHub.
  - New PC? Install Python 3.12, copy the folder, double-click setup.bat once. Done.

IF SOMETHING FAILS
  Copy the text in the black window and send it to Claude.

USING VS CODE
  1. File > Open Folder... > choose THIS folder (the one that contains "app" and "setup.bat").
  2. Double-click setup.bat once (outside VS Code is fine) - this creates the private ".venv".
  3. Press F5 (or click Run and Debug on the left) and pick:
        1. Run the app   2. Run tests   3. Run Bitext evaluation
     If VS Code asks which Python to use: choose the one inside ".venv".
  Typing commands instead? In the VS Code terminal use:
        .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
