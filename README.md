# A modern, community-driven jukebox built for the YouTube era.

<p align="center"><img src="DemoImages/demo2.png" width="400" alt="Appdemo Top menu"></p>

## 1. Core Idea

A **social, democratic music experience** built on top of YouTube.

Users join **Host Channels**.  
The main feature is the **Suggest & Vote system**:

- Participants submit songs.  
- Moderators review them (if required).  
- The community votes songs up or down.  
- The playlist dynamically updates based on these votes.  

Playback happens either **centrally on a shared screen** (bars, parties, venues) or **individually via Watch-Together mode**.

**Goal:** Make music selection communal, fair, and fun — a modern jukebox powered by YouTube.

---

## 2. Playback Modes

### Suggest & Vote (Default & Core Mode)
- Phones are used to suggest songs, vote, and browse the queue.  
- Playback happens on the central screen (TV, projector, or host’s device).  
- Primary mode for bars, parties, and shared spaces.

### Watch-Together (Optional Side Feature)
- Everyone watches/listens on their own device, synced in real time.

---

## 3. Roles & Permissions

### Defaults

**Admin / Host**
- Creates and configures the channel.  
- Assigns Moderators and Supporters.  
- Creates and assigns **custom roles** with tailored permissions.

**Moderator (default powers)**
- Can Direct-Play (skip queue and start a chosen song).  
- Can open or close suggestions at any time.  
- Can delete or blacklist songs.

**Supporter (default powers)**
- Can approve songs.

---

## 4. Queue & User Interaction Features

**Suggest & Vote System:**  
The central mechanic; users push songs into the queue, others vote them up or down.

**Queue Item Functions:**  
Tapping a song reveals options such as:
- Song lyrics.  
- Prelisten.  
- Save to personal playlist.

**Toggle Prelisten:**  
Users can preview a short snippet of a song before voting.

**Auto-Approve Option:**  
Already accepted songs can bypass approval in future sessions.

**Queue Continuity:**  
If empty, fallback to autoplay or history, depending on admin setting.

---

## 5. User Features

- **Real-time Queue:** Visible to everyone on their phone.  
- **Voting Dynamics:** Songs rise or fall with community votes.  
- **History & Favorites:**
  - Track what was played and when.  
  - Mark favorites for reuse.  
- **Save to Personal Playlist:** Keep your favorite picks from any session.  
- **View Lyrics:** Read along while listening.  
- **Multi-device:** Central screen playback in venues + mobile control interface.  
- **Watch-Together (optional):** Everyone streams in sync individually.

---

## 6. Example Scenarios

Picture it:

The lights are low, the crowd hums, and a playlist takes shape — not by a DJ, but by everyone in the room.  
Phones glow as votes ripple through the queue; the next track is a collective decision, not a request shouted over music.  
One city’s bar, another’s living room, a hundred online rooms — all beating to the same rhythm of shared discovery.  

> It’s not radio.  
> It’s not a playlist.  
> It’s a living, breathing soundtrack built by people, not algorithms.

---

## 7. Technical Overview

- **YouTube iFrame Player API** for compliant playback.  
- **Realtime Backend (WebSockets)** to sync votes, queue, and playback state.  
- **Queue Algorithm** weighted by votes, roles, and permissions.  
- **Fallback Logic** for empty queues (autoplay or history).  
- **Scalability & Abuse Prevention:** rate limits, bot detection, venue-only modes.

---

## 8. Value Proposition

### For Users
- Fun, interactive way to shape music in a group or at a party.  
- Creates a fair, democratic space for discovering and sharing YouTube music together.  
- Works seamlessly with official YouTube playback — preserving video quality, ads, and creator support.  
- Optional perks (like advanced voting weight or cosmetic rewards) can enhance participation without paywalls.

### For Venues
- Transforms any venue into a living, crowd-powered jukebox.  
- Encourages guests to engage longer and feel part of the playlist experience.  
- Operates within YouTube’s legal framework when using official embeds.  
- Venues remain responsible for public performance licenses (e.g. GEMA, Buma/Stemra/Sena), as with traditional background music systems.

### For YouTube / Google
- Increases total watch time, ad impressions, and community retention.  
- Expands YouTube’s footprint into social, real-world, and hybrid events.  
- Demonstrates responsible third-party innovation using YouTube’s APIs.  
- Creates future opportunities for monetization through partnerships, venue integrations, or premium channel models.

---

## Credits

Created by **Julian Zienert**  
jzienert@student.codam.nl  
Concept & Documentation © 2025

---

**Where community meets rhythm — every vote changes the beat.**
