const LIVEKIT_URL = 'wss://demo-z1xi0pi0.livekit.cloud';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjY1NzQ2NjEsImlkZW50aXR5IjoicGFydGljaXBhbnQtMiIsImlzcyI6IkFQSWlpajhGeFliUlZ6RiIsIm5hbWUiOiJwYXJ0aWNpcGFudC0yIiwibmJmIjoxNzY1OTY5ODYxLCJzdWIiOiJwYXJ0aWNpcGFudC0yIiwidmlkZW8iOnsicm9vbSI6Im15LXRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.oKBiVf9kBUbuVoUlbHog67E120QzKOq15BGuSyrNJgI';

import {
  Room,
  RoomEvent,
  RemoteTrack,
  Track,
  LocalParticipant,
  Participant,
} from 'livekit-client';

const room = new Room({ adaptiveStream: true, dynacast: true });

// State Tracking
let micEnabled = true;
let camEnabled = true;
let myDisplayName = "";

const errorDiv = document.getElementById('error-msg')!;

// 1. Lobby Setup - Fixed Assignment target error
const lobbyMic = document.getElementById('lobby-mic');
if (lobbyMic) {
    lobbyMic.onclick = () => {
        micEnabled = !micEnabled;
        lobbyMic.classList.toggle('off', !micEnabled);
        lobbyMic.innerText = micEnabled ? '🎤' : '🔇';
    };
}

const lobbyCam = document.getElementById('lobby-cam');
if (lobbyCam) {
    lobbyCam.onclick = () => {
        camEnabled = !camEnabled;
        lobbyCam.classList.toggle('off', !camEnabled);
        lobbyCam.innerText = camEnabled ? '📷' : '🚫';
    };
}

// 2. Join Functionality
const joinBtn = document.getElementById('join-btn');
if (joinBtn) {
    joinBtn.onclick = async () => {
        myDisplayName = (document.getElementById('username') as HTMLInputElement).value || 'Guest';
        (errorDiv as HTMLElement).style.display = 'none';

        try {
            await room.connect(LIVEKIT_URL, TOKEN);
            
            document.getElementById('lobby-screen')!.classList.remove('active');
            document.getElementById('call-ui')!.classList.add('active');

            // Apply lobby settings immediately
            await room.localParticipant.setMicrophoneEnabled(micEnabled);
            await room.localParticipant.setCameraEnabled(camEnabled);

            // Sync meeting buttons UI
            document.getElementById('toggle-mic')?.classList.toggle('off', !micEnabled);
            document.getElementById('toggle-video')?.classList.toggle('off', !camEnabled);

            renderParticipant(room.localParticipant, myDisplayName);
            updateGridLayout();
        } catch (e: any) {
            console.error(e);
            (errorDiv as HTMLElement).style.display = 'block';
            (errorDiv as HTMLElement).innerText = e.name === 'NotReadableError' 
                ? "Camera is busy. Close other apps." 
                : "Could not connect to meeting.";
        }
    };
}

// 3. Track Subscriptions
room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant) => {
    if (track.kind === Track.Kind.Video) {
        const el = track.attach();
        const vContainer = document.getElementById(`video-${participant.identity}`);
        if (vContainer) {
            vContainer.innerHTML = ""; // Clear existing
            vContainer.appendChild(el);
        }
    } else if (track.kind === Track.Kind.Audio) {
        document.body.appendChild(track.attach());
    }
    syncMediaUI(participant);
});

// Listen for remote mutes
room.on(RoomEvent.TrackMuted, (pub, p) => syncMediaUI(p));
room.on(RoomEvent.TrackUnmuted, (pub, p) => syncMediaUI(p));

room.on(RoomEvent.ParticipantConnected, (p) => {
    renderParticipant(p, p.identity);
    updateGridLayout();
});

room.on(RoomEvent.ParticipantDisconnected, (p) => {
    document.getElementById(`tile-${p.identity}`)?.remove();
    updateGridLayout();
});

// 4. Rendering Engine
function renderParticipant(p: Participant, name: string) {
    if (document.getElementById(`tile-${p.identity}`)) return;

    const tile = document.createElement('div');
    tile.id = `tile-${p.identity}`;
    tile.className = 'participant-tile';
    
    // Avatar Layer
    const avatar = document.createElement('div');
    avatar.id = `avatar-${p.identity}`;
    avatar.className = 'avatar-container';
    avatar.innerText = name.charAt(0).toUpperCase();
    
    // Video Area
    const videoArea = document.createElement('div');
    videoArea.id = `video-${p.identity}`;
    videoArea.style.height = "100%";
    
    // Name Label
    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerText = name + (p instanceof LocalParticipant ? ' (You)' : '');
    
    tile.append(avatar, videoArea, nameTag);
    document.getElementById('video-grid')!.appendChild(tile);

    // Initial publish render for local
    if (p instanceof LocalParticipant) {
        p.trackPublications.forEach(pub => {
            if (pub.track && pub.kind === Track.Kind.Video) {
                const el = pub.track.attach();
                el.classList.add('local-video');
                videoArea.appendChild(el);
            }
        });
    }
    syncMediaUI(p);
}

function syncMediaUI(p: Participant) {
    const videoEl = document.querySelector(`#video-${p.identity} video`) as HTMLElement;
    const avatarEl = document.getElementById(`avatar-${p.identity}`);
    const isCamOn = p.isCameraEnabled;

    if (videoEl) videoEl.style.opacity = isCamOn ? "1" : "0";
    if (avatarEl) avatarEl.style.zIndex = isCamOn ? "0" : "1";
}

function updateGridLayout() {
    const grid = document.getElementById('video-grid')!;
    const count = grid.children.length;
    grid.setAttribute('data-participants', count.toString());
}

// 5. FIXED Controls - Standard 'if' checks to avoid esbuild errors
const micToggle = document.getElementById('toggle-mic');
if (micToggle) {
    micToggle.onclick = async () => {
        const enabled = !room.localParticipant.isMicrophoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(enabled);
        micToggle.classList.toggle('off', !enabled);
    };
}

const camToggle = document.getElementById('toggle-video');
if (camToggle) {
    camToggle.onclick = async () => {
        const enabled = !room.localParticipant.isCameraEnabled;
        try {
            await room.localParticipant.setCameraEnabled(enabled);
            camToggle.classList.toggle('off', !enabled);
            syncMediaUI(room.localParticipant);
        } catch (e) {
            alert("Camera is currently unavailable.");
        }
    };
}

const leaveBtn = document.getElementById('leave-btn');
if (leaveBtn) {
    leaveBtn.onclick = async () => {
        await room.disconnect();
        document.getElementById('call-ui')!.classList.remove('active');
        document.getElementById('end-screen')!.classList.add('active');
    };
}