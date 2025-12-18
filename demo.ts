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
  LocalVideoTrack,
} from 'livekit-client';



const room = new Room({ adaptiveStream: true, dynacast: true });

let micEnabled = true;
let camEnabled = true;
let myDisplayName = "";
let localTracks: LocalTrack[] = [];

const errorDiv = document.getElementById('error-msg')!;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const lobbyPreview = document.getElementById('lobby-preview-container')!;
const camOffOverlay = document.getElementById('camera-off-overlay')!;
const lobbyMic = document.getElementById('lobby-mic')!;
const lobbyCam = document.getElementById('lobby-cam')!;

// 1. EARLY PERMISSIONS & PREVIEW
async function initializeLobby() {
    try {
        localTracks = await createLocalTracks({
            audio: true,
            video: { facingMode: 'user' }
        });

        const videoTrack = localTracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack;
        if (videoTrack) {
            const el = videoTrack.attach();
            lobbyPreview.appendChild(el);
        }

        document.getElementById('perm-text')!.innerText = "Media ready.";
        document.getElementById('perm-spinner')!.style.display = 'none';
    } catch (e) {
        console.error("Permissions denied", e);
        errorDiv.style.display = 'block';
        errorDiv.innerText = "Camera/Mic access is required.";
    }
}

initializeLobby();

// 2. LOBBY TOGGLE LOGIC
lobbyMic.onclick = () => {
    micEnabled = !micEnabled;
    lobbyMic.classList.toggle('off', !micEnabled);
    lobbyMic.innerText = micEnabled ? '🎤' : '🔇';
    
    localTracks.forEach(t => {
        if (t.kind === Track.Kind.Audio) {
            if (micEnabled) {
                t.unmute();
            } else {
                t.mute();
            }
        }
    });
};

lobbyCam.onclick = () => {
    camEnabled = !camEnabled;
    lobbyCam.classList.toggle('off', !camEnabled);
    lobbyCam.innerText = camEnabled ? '📷' : '🚫';

    localTracks.forEach(t => {
        if (t.kind === Track.Kind.Video) {
            const videoTrack = t as LocalVideoTrack;
            
            if (camEnabled) {
                // Turn camera back on
                videoTrack.unmute();
            } else {
                // Turn camera off
                videoTrack.mute();
            }
        }
    });

    // Update UI
    const videoEl = lobbyPreview.querySelector('video');
    if (videoEl) {
        videoEl.style.display = camEnabled ? "block" : "none";
    }
    camOffOverlay.style.display = camEnabled ? "none" : "flex";
};

// 3. JOIN CALL LOGIC
if (joinBtn) {
    joinBtn.onclick = async () => {
        myDisplayName = (document.getElementById('username') as HTMLInputElement).value || 'Guest';
        
        joinBtn.disabled = true;
        document.getElementById('join-text')!.innerText = "Connecting...";
        document.getElementById('join-spinner')!.style.display = "block";

        try {
            await room.connect(LIVEKIT_URL, TOKEN);
            
            document.getElementById('lobby-screen')!.classList.remove('active');
            document.getElementById('call-ui')!.classList.add('active');

            // Pass initial state to publication
            for (const track of localTracks) {
                if (track.kind === Track.Kind.Audio) {
                    await room.localParticipant.publishTrack(track);
                    if (!micEnabled) {
                        await room.localParticipant.setMicrophoneEnabled(false);
                    }
                } else if (track.kind === Track.Kind.Video) {
                    await room.localParticipant.publishTrack(track);
                    if (!camEnabled) {
                        await room.localParticipant.setCameraEnabled(false);
                    }
                }
            }

            document.getElementById('toggle-mic')?.classList.toggle('off', !micEnabled);
            document.getElementById('toggle-video')?.classList.toggle('off', !camEnabled);

            renderParticipant(room.localParticipant, myDisplayName);

            room.remoteParticipants.forEach((p) => {
                renderParticipant(p, p.identity);
                p.trackPublications.forEach(pub => {
                    if (pub.track && pub.isSubscribed) {
                        handleTrackSubscribed(pub.track as RemoteTrack, pub, p);
                    }
                });
            });

            updateGridLayout();
        } catch (e) {
            console.error(e);
            joinBtn.disabled = false;
            document.getElementById('join-text')!.innerText = "Join Meeting";
            document.getElementById('join-spinner')!.style.display = "none";
            errorDiv.style.display = 'block';
            errorDiv.innerText = "Failed to connect.";
        }
    };
}

// 4. CALL LOGIC & RENDERING
function handleTrackSubscribed(
    track: RemoteTrack,
    publication: any,
    participant: Participant
) {
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

room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
room.on(RoomEvent.TrackMuted, (pub, p) => syncMediaUI(p));
room.on(RoomEvent.TrackUnmuted, (pub, p) => syncMediaUI(p));
room.on(RoomEvent.ParticipantConnected, (p) => { renderParticipant(p, p.identity); updateGridLayout(); });
room.on(RoomEvent.ParticipantDisconnected, (p) => { document.getElementById(`tile-${p.identity}`)?.remove(); updateGridLayout(); });

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
    grid.setAttribute('data-participants', grid.children.length.toString());
}

// 5. LEAVE & UI CONTROLS
document.getElementById('leave-btn')!.onclick = async () => {
    await room.disconnect();
    document.getElementById('call-ui')!.classList.remove('active');
    document.getElementById('end-screen')!.classList.add('active');
};

document.getElementById('toggle-mic')!.onclick = async () => {
    const enabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    document.getElementById('toggle-mic')!.classList.toggle('off', !enabled);
};

document.getElementById('toggle-video')!.onclick = async () => {
    const enabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(enabled);
    document.getElementById('toggle-video')!.classList.toggle('off', !enabled);
    syncMediaUI(room.localParticipant);
};