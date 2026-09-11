# Connect your private workout history

The public workout app stays at https://clonmacnoise.github.io/workout/w.html.
Your personal history will live in a separate **private** GitHub repository named **workout-history**, owned by **clonmacnoise**.

## One-time GitHub setup

1. Sign in to GitHub as **clonmacnoise** and create a new repository named **workout-history**. Select **Private** and add a README when creating it. Do not publish this repository with GitHub Pages.
2. In GitHub Settings, open **Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
3. Choose **clonmacnoise** as the resource owner. Under repository access, select **Only select repositories**, and select **workout-history** only.
4. Under repository permissions, grant **Contents: Read and write**. Leave other permissions at their defaults. Choose an expiration you can manage.
5. Generate the key and save it in your password manager. Do not add it to your repository, source files, URLs, screenshots, or this conversation.

## Connect the app

1. Open the workout app on your preferred device. Paste the key into the app's **GitHub access key** field and select **Connect private history**.
2. On the first device only, select **Start new history · September 11**. This creates a fresh history starting September 11, 2026, with Day 1 and no previous workouts or misses. If a cloud history already exists, the app loads it instead of overwriting it.
3. Check that the app says **Saved to GitHub**. On each additional device, connect with the same restricted key; the saved history will load automatically.

The key is kept only for the current browser tab/app session. You may need to reconnect after closing the session or when the key expires. Replacing your phone does not remove history stored in GitHub. Enter the key directly into the app on the new device.

## Saving and multiple devices

- The dated history is authoritative. All devices use America/Los_Angeles calendar dates so travel or device timezone settings cannot split a workout window.
- Two-day workout windows, 90-day miss thresholds, the yearly completion count, and consecutive-workout messages retain their existing rules.
- A completion is saved locally as pending before upload. **Waiting to sync** means that completion is still dependent on that device. Wait for **Saved to GitHub** before retiring or clearing a device.
- Only one completion can be pending on a device at a time. Reconnect and sync before recording the next one.
- The app reads the latest cloud history before each write. Conditional writes and retries prevent a stale device from overwriting a newer version. The same workout window cannot be completed twice.
- When an offline completion conflicts with a changed schedule, the app keeps it pending for review. **Use saved cloud history** discards only this device's unsaved completion after confirmation.
- A new browser, a failed network request, or an unreadable history never overwrites the cloud with an empty record.
- **Save backup** downloads the most recently loaded cloud history and any pending completion. GitHub also keeps committed versions in the private repository.

## Files to upload to the public workout repository

Upload `w.html`, `program.js`, `history.js`, `sync.js`, `github-store.js`, `cloud.js`, and this `CLOUD_SETUP.md`. Keep the existing `Workout Program_files` folder. No compilation is needed.

Never upload your private `history.json` file or your access key to the public workout repository.

## Validation status

The history engine, multi-device synchronization, and browser interface can be tested with simulated GitHub responses. A real private-repository save and reload must still be checked after you configure access. The code does not contain an access key and cannot create or read your private history until connected.
