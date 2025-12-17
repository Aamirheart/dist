const LIVEKIT_URL = 'wss://demo-z1xi0pi0.livekit.cloud';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjY1NzQ2NjEsImlkZW50aXR5IjoicGFydGljaXBhbnQtMiIsImlzcyI6IkFQSWlpajhGeFliUlZ6RiIsIm5hbWUiOiJwYXJ0aWNpcGFudC0yIiwibmJmIjoxNzY1OTY5ODYxLCJzdWIiOiJwYXJ0aWNpcGFudC0yIiwidmlkZW8iOnsicm9vbSI6Im15LXRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.oKBiVf9kBUbuVoUlbHog67E120QzKOq15BGuSyrNJgI';

import { Room, RoomEvent, Track, LogLevel, setLogLevel } from 'livekit-client';

setLogLevel(LogLevel.warn);

let room: Room | undefined;

const joinScreen = document.getElementById('join-screen')!;
const callContainer = document.getElementById('call-container')!;
const grid = document.getElementById('video-grid')!;
const audioBtn = document.getElementById('audio-btn')!;
const videoBtn = document.getElementById('video-btn')!;

const appActions = {
  connect: async () => {
    joinScreen.style.display = 'none';
    callContainer.style.display = 'block';

    room = new Room({ adaptiveStream: true, dynacast: true });
    await room.connect(LIVEKIT_URL, TOKEN);

    // Audio ON, Video OFF
    await room.localParticipant.setMicrophoneEnabled(true);
    await room.localParticipant.setCameraEnabled(false);
    updateAudioUI(true);
    updateVideoUI(false);

    // ✅ Add local participant tile
    addParticipantTile(room.localParticipant);

    // ✅ Add already-present remote participants (CRITICAL FIX)
    room.remoteParticipants.forEach((p) => {
      addParticipantTile(p);
      attachExistingTracks(p);
    });

    // ✅ Listen for future events
    room
      .on(RoomEvent.ParticipantConnected, (p) => {
        addParticipantTile(p);
        attachExistingTracks(p);
      })
      .on(RoomEvent.ParticipantDisconnected, removeParticipantTile)
      .on(RoomEvent.TrackSubscribed, attachRemoteTrack)
      .on(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
  },

  toggleAudio: async () => {
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    updateAudioUI(!enabled);
  },

  toggleVideo: async () => {
    if (!room) return;

    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    updateVideoUI(!enabled);

    if (!enabled) {
      attachLocalCamera();
    } else {
      // Clear the video when turning camera off
      const participant = room.localParticipant;
      const tile = document.getElementById(`p-${participant.identity}`);
      const video = tile?.querySelector('video') as HTMLVideoElement;
      if (video) video.srcObject = null;
    }
  },

  disconnectRoom: () => {
    room?.disconnect();
    location.reload();
  },
};

/* ---------------- PARTICIPANTS ---------------- */

function addParticipantTile(participant: any) {
  if (document.getElementById(`p-${participant.identity}`)) return;

  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `p-${participant.identity}`;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  if (participant.isLocal) video.muted = true;

  const label = document.createElement('div');
  label.className = 'name-tag';
  label.textContent = participant.identity;

  tile.append(video, label);
  grid.appendChild(tile);
}

function removeParticipantTile(participant: any) {
  document.getElementById(`p-${participant.identity}`)?.remove();
}

/* ---------------- TRACK HANDLING ---------------- */

// ✅ Attach tracks that already exist (MOST IMPORTANT FIX)
function attachExistingTracks(participant: any) {
  participant.getTrackPublications().forEach((pub: any) => {
    if (pub.track && pub.kind === 'video') {
      const tile = document.getElementById(`p-${participant.identity}`);
      const video = tile?.querySelector('video') as HTMLVideoElement;
      if (video) pub.track.attach(video);
    }
  });
}

// ✅ Local camera must be attached manually
function attachLocalCamera() {
  if (!room) return;

  const participant = room.localParticipant;
  const tile = document.getElementById(`p-${participant.identity}`);
  if (!tile) return;

  const video = tile.querySelector('video') as HTMLVideoElement;
  const pub = participant.getTrackPublication(Track.Source.Camera);

  if (pub?.videoTrack) {
    pub.videoTrack.attach(video);
    video.muted = true;
  }
}

// ✅ Remote tracks (future publishes)
function attachRemoteTrack(track: any, pub: any, participant: any) {
  if (track.kind !== 'video') return;

  const tile = document.getElementById(`p-${participant.identity}`);
  const video = tile?.querySelector('video') as HTMLVideoElement;
  if (video) track.attach(video);
}

function detachRemoteTrack(_: any, pub: any, participant: any) {
  if (pub.kind !== 'video') return;

  const tile = document.getElementById(`p-${participant.identity}`);
  const video = tile?.querySelector('video') as HTMLVideoElement;
  if (video) video.srcObject = null;
}

/* ---------------- UI ---------------- */

function updateAudioUI(enabled: boolean) {
  audioBtn.textContent = enabled ? '🎤' : '🔇';
  audioBtn.classList.toggle('off', !enabled);
}

function updateVideoUI(enabled: boolean) {
  videoBtn.classList.toggle('off', !enabled);
}

declare global {
  interface Window {
    appActions: typeof appActions;
  }
}

window.appActions = appActions;