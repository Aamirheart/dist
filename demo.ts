const LIVEKIT_URL = 'wss://demo-z1xi0pi0.livekit.cloud';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjY1NzQ2NjEsImlkZW50aXR5IjoicGFydGljaXBhbnQtMiIsImlzcyI6IkFQSWlpajhGeFliUlZ6RiIsIm5hbWUiOiJwYXJ0aWNpcGFudC0yIiwibmJmIjoxNzY1OTY5ODYxLCJzdWIiOiJwYXJ0aWNpcGFudC0yIiwidmlkZW8iOnsicm9vbSI6Im15LXRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.oKBiVf9kBUbuVoUlbHog67E120QzKOq15BGuSyrNJgI';

import {
  Room,
  RoomEvent,
  RemoteTrack,
  Track,
  LocalParticipant,
  Participant,
  createLocalTracks,
  LocalTrack,
} from 'livekit-client';

const room = new Room({ adaptiveStream: true, dynacast: true });


// State Tracking
let micEnabled = true;
let camEnabled = true;
let myDisplayName = "";
let localTracks: LocalTrack[] = [];

// DOM Elements
const errorDiv = document.getElementById('error-msg')!;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const joinText = document.getElementById('join-text')!;
const joinSpinner = document.getElementById('join-spinner')!;
const permStatus = document.getElementById('permission-status')!;

// 1. EARLY PERMISSIONS - Ask as soon as page loads
async function requestPermissionsEarly() {
    try {
        localTracks = await createLocalTracks({
            audio: true,
            video: { facingMode: 'user' }
        });
        console.log("Permissions granted early.");
        
        // Hide the permission requesting UI
        permStatus.style.opacity = '0.5';
        document.getElementById('perm-text')!.innerText = "Media ready.";
        document.getElementById('perm-spinner')!.style.display = 'none';
    } catch (e) {
        console.error("User denied permissions or error occurred", e);
        (errorDiv as HTMLElement).style.display = 'block';
        (errorDiv as HTMLElement).innerText = "Please allow camera access to continue.";
    }
}

requestPermissionsEarly();

// Lobby Controls
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

// 2. JOIN FUNCTIONALITY with Loading State
if (joinBtn) {
    joinBtn.onclick = async () => {
        myDisplayName = (document.getElementById('username') as HTMLInputElement).value || 'Guest';
        (errorDiv as HTMLElement).style.display = 'none';

        // START LOADING STATE
        joinBtn.disabled = true;
        joinText.innerText = "Joining...";
        (joinSpinner as HTMLElement).style.display = "block";

        try {
            await room.connect(LIVEKIT_URL, TOKEN);
            
            document.getElementById('lobby-screen')!.classList.remove('active');
            document.getElementById('call-ui')!.classList.add('active');

            // Publish the tracks we pre-acquired
            for (const track of localTracks) {
                if (track.kind === Track.Kind.Audio) {
                    await room.localParticipant.publishTrack(track, { enabled: micEnabled });
                } else {
                    await room.localParticipant.publishTrack(track, { enabled: camEnabled });
                }
            }

            // Sync meeting buttons UI
            document.getElementById('toggle-mic')?.classList.toggle('off', !micEnabled);
            document.getElementById('toggle-video')?.classList.toggle('off', !camEnabled);

            renderParticipant(room.localParticipant, myDisplayName);

            // 3. HANDLE PEOPLE ALREADY IN THE ROOM
            room.remoteParticipants.forEach((participant) => {
                console.log('Existing participant found:', participant.identity);
                renderParticipant(participant, participant.identity);
                
                // Manually check for existing tracks
                participant.trackPublications.forEach((pub) => {
                    if (pub.track && pub.isSubscribed) {
                        handleTrackAttached(pub.track as RemoteTrack, participant);
                    }
                });
            });

            updateGridLayout();
        } catch (e: any) {
            console.error(e);
            // RESET LOADING STATE ON ERROR
            joinBtn.disabled = false;
            joinText.innerText = "Join Meeting";
            (joinSpinner as HTMLElement).style.display = "none";

            (errorDiv as HTMLElement).style.display = 'block';
            (errorDiv as HTMLElement).innerText = "Could not connect to meeting.";
        }
    };
}

// Track Subscriptions helper
function handleTrackAttached(track: RemoteTrack, participant: Participant) {
    if (track.kind === Track.Kind.Video) {
        const el = track.attach();
        const vContainer = document.getElementById(`video-${participant.identity}`);
        if (vContainer) {
            vContainer.innerHTML = ""; 
            vContainer.appendChild(el);
        }
    } else if (track.kind === Track.Kind.Audio) {
        document.body.appendChild(track.attach());
    }
    syncMediaUI(participant);
}

room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant) => {
    handleTrackAttached(track, participant);
});

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
    
    const avatar = document.createElement('div');
    avatar.id = `avatar-${p.identity}`;
    avatar.className = 'avatar-container';
    avatar.innerText = name.charAt(0).toUpperCase();
    
    const videoArea = document.createElement('div');
    videoArea.id = `video-${p.identity}`;
    videoArea.style.height = "100%";
    
    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.innerText = name + (p instanceof LocalParticipant ? ' (You)' : '');
    
    tile.append(avatar, videoArea, nameTag);
    document.getElementById('video-grid')!.appendChild(tile);

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

// 5. Controls
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