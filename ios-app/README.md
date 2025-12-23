# CueVote iOS & iPadOS Native Wrapper

This directory contains the Swift source files to create a native iOS and iPadOS wrapper app for CueVote. It matches the core functionality of the Android wrapper (specifically Wakelock and Autoplay permissions) and ensures the web app functionality works seamlessly.

## Supported Platforms

*   **iPhone (iOS)**: Fully Supported
*   **iPad (iPadOS)**: Fully Supported
*   **Apple TV (tvOS)**: **NOT Supported**
    *   *Reason*: Apple TV (tvOS) does not include the `WebKit` framework, meaning "WebViews" (browsers inside apps) are strictly prohibited and technically unavailable. The only way to support Apple TV is to rewrite the application natively using SwiftUI or TVML, which is outside the scope of this wrapper.
    *   *Workaround*: Users can AirPlay content from their iPhone/iPad wrapper to the Apple TV.

## Setup Instructions

Prerequisites: **Mac with Xcode installed**.

1.  **Open Xcode** and create a **New Project**.
    *   Select **iOS** -> **App**.
    *   Click **Next**.
2.  **Configure the Project**:
    *   Product Name: `CueVote`
    *   Interface: **SwiftUI**
    *   Language: **Swift**
    *   Organization Identifier: `com.cuevote` (or your preferred ID)
    *   Click **Next** and save it.
3.  **Setup Universal Support (iPhone & iPad)**:
    *   Click on the **Project File** (blue icon at the top of the file navigator).
    *   Select the **Target** (CueVote).
    *   In the **General** tab, look for **Supported Destinations**.
    *   Ensure both **iPhone** and **iPad** are present.
4.  **Import Files**:
    *   Replace the generated `CueVoteApp.swift` with the one provided in `CueVote/CueVoteApp.swift`.
    *   Replace `ContentView.swift` with `CueVote/ContentView.swift`.
    *   Add `CueVote/WebView.swift` to your project (Drag & Drop into Xcode file navigator, ensuring "Copy items if needed" is checked).
5.  **Build and Run**:
    *   Select an iPhone or iPad simulator/device and press **Cmd + R**.

## Key Features Implemented

*   **Universal Layout**: Works on both iPhone and iPad.
*   **Wakefulness**: Screen stays on (`isIdleTimerDisabled = true`).
*   **Autoplay**: Media plays automatically (Restrictions disabled in `WKWebViewConfiguration`).
*   **Detection**: Seamlessly detected by the web client as "Wrapper" avoiding the "Install App" block page.
