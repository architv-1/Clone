document.addEventListener('DOMContentLoaded', () => {
    const musicLibrary = {
        songs: [],
        currentAudio: null,
        currentlyPlayingIndex: null,
        songsFolder: '/songs/',
        

        async fetchSongsFromFolder(folderPath) {
            try {
                if (!folderPath || folderPath.trim() === '') {
                    throw new Error('No folder path specified.');
                }

                const jsonPath = `/songs/${folderPath}.json`;
                console.log('Fetching playlist JSON from:', jsonPath);

                let response = await fetch(jsonPath);
                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn(`Playlist JSON not found: ${jsonPath}`);
                        return []; // Return empty array for 404
                    }
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }

                const data = await response.json();
                const newSongs = data.songs
                    .map(song => ({
                        name: song.name,
                        url: `/${this.songsFolder}${encodeURIComponent(folderPath)}/${encodeURIComponent(song.name)}` // Encode both folder and file name
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                console.log('Fetched songs from JSON with encoded URLs:', newSongs);
                if (newSongs.length === 0) {
                    this.showError(`No MP3 files found in ${folderPath}.`);
                }

                return newSongs;
            } catch (error) {
                console.error('Error loading songs from folder:', error);
                this.showError(`Failed to load songs from ${folderPath}: ${error.message}`);
                return [];
            }
        },

        renderSongList() {
            const songList = document.querySelector('.songlist ul');
            if (!songList) {
                console.error('Element with class "songlist ul" not found in the DOM.');
                this.showError('Failed to find song list container.');
                return;
            }

            songList.innerHTML = '';

            if (this.songs.length === 0) {
                songList.innerHTML = '<li style="margin: 15px;">No songs available. Please Select Playlist</li>';
                return;
            }

            this.songs.forEach((song, index) => {
                const li = document.createElement('li');
                li.className = 'song-item';
                li.innerHTML = `
                    <span class="song-name">${song.name}</span>
                    <button class="play-btn" data-index="${index}">Play</button>
                `;
                songList.appendChild(li);
            });

            document.querySelectorAll('.play-btn').forEach(button => {
                button.removeEventListener('click', this.togglePlayPauseHandler);
                button.addEventListener('click', this.togglePlayPauseHandler = (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.togglePlayPause(index);
                });
            });
        },

        updatePlaylistSongs(folderPath) {
            const songList = document.querySelector('.songlist ul');
            if (!songList) {
                console.error('Element with class "songlist ul" not found in the DOM.');
                this.showError('Failed to find library container.');
                return;
            }

            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio.removeEventListener('timeupdate', this.updateProgressBar.bind(this));
                this.currentAudio.removeEventListener('ended', this.nextSong.bind(this));
                this.currentAudio = null;
            }

            songList.innerHTML = '<li>Loading songs...</li>';

            this.fetchSongsFromFolder(folderPath).then(newSongs => {
                this.songs = newSongs;
                this.currentlyPlayingIndex = null;
                this.renderSongList();
                this.updatePlaybar('paused');
                console.log('Playlist switched - Audio reset, new songs:', this.songs);
            }).catch(error => {
                console.error('Error updating playlist:', error);
                this.showError('Failed to update playlist.');
            });
        },

        async playSong(index) {
            const song = this.songs[index];
            if (!song) {
                this.showError('No song selected or available.');
                return;
            }

            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio.removeEventListener('timeupdate', this.updateProgressBar.bind(this));
                this.currentAudio.removeEventListener('ended', this.nextSong.bind(this));
                this.currentAudio = null;
            }

            this.currentAudio = new Audio(song.url);
            this.currentlyPlayingIndex = parseInt(index);

            try {
                console.log('Attempting to play:', song.url);
                await new Promise((resolve, reject) => {
                    this.currentAudio.addEventListener('loadedmetadata', () => {
                        const totalMinutes = Math.floor(this.currentAudio.duration / 60);
                        const totalSeconds = Math.floor(this.currentAudio.duration % 60).toString().padStart(2, '0');
                        const songDuration = document.querySelector('.song-duration');
                        if (songDuration) {
                            songDuration.textContent = `${totalMinutes}:${totalSeconds}`;
                        }
                        resolve();
                    }, { once: true });
                    this.currentAudio.addEventListener('error', () => {
                        reject(new Error('Failed to load audio metadata'));
                    }, { once: true });
                });

                await this.currentAudio.play();
                console.log('Successfully playing:', song.url);
                this.updatePlayButtons(index, 'Pause');
                this.updatePlaybar('playing', song.name);
                this.updateSongInfo(song.name);

                this.currentAudio.addEventListener('timeupdate', () => this.updateProgressBar());
                this.currentAudio.addEventListener('ended', () => this.nextSong());
            } catch (error) {
                console.error('Error playing song:', error, 'URL:', song.url);
                this.showError(`Failed to play "${song.name}": ${error.message || 'Check file path, format, or deployment'}`);
                this.currentAudio = null;
                this.currentlyPlayingIndex = null;
                this.updatePlaybar('paused');
                this.updatePlayButtons(index, 'Play');
            }
        },

        togglePlayPause(index) {
            const selectedButton = document.querySelector(`.play-btn[data-index="${index}"]`);
            if (!selectedButton) {
                console.error('Play button not found for index:', index);
                return;
            }

            console.log('Toggle Play/Pause for index:', index, 'Current Audio:', this.currentAudio, 'Current Index:', this.currentlyPlayingIndex);

            if (this.currentAudio && this.currentlyPlayingIndex === parseInt(index)) {
                if (this.currentAudio.paused) {
                    this.currentAudio.play().then(() => {
                        selectedButton.textContent = 'Pause';
                        this.updatePlaybar('playing');
                        console.log('Playing song from list:', this.currentAudio.src);
                    }).catch(error => {
                        console.error('Error resuming playback:', error);
                        this.showError('Failed to resume playback.');
                    });
                } else {
                    this.currentAudio.pause();
                    selectedButton.textContent = 'Play';
                    this.updatePlaybar('paused');
                    console.log('Paused song from list:', this.currentAudio.src);
                }
            } else {
                this.playSong(index);
            }
        },

        playOrPause() {
            const playButtonImg = document.getElementById('play');
            if (!playButtonImg) {
                console.error('Play button not found in DOM.');
                return;
            }

            console.log('Play/Pause clicked - Audio:', this.currentAudio, 'Songs:', this.songs.length);

            if (!this.songs.length) {
                this.showError('Please Select Playlist.');
                return;
            }

            if (this.currentAudio) {
                if (this.currentAudio.paused) {
                    this.currentAudio.play().then(() => {
                        playButtonImg.src = 'img/pause.svg';
                        this.updatePlayButtonInList('Pause');
                        this.updatePlaybar('playing');
                        console.log('Playing song:', this.currentAudio.src);
                    }).catch(error => {
                        console.error('Error resuming playback:', error);
                        this.showError('Failed to resume playback.');
                    });
                } else {
                    this.currentAudio.pause();
                    playButtonImg.src = 'img/play.svg';
                    this.updatePlayButtonInList('Play');
                    this.updatePlaybar('paused');
                    console.log('Paused song:', this.currentAudio.src);
                }
            } else {
                this.playSong(0);
            }
        },

        previousSong() {
            if (this.currentlyPlayingIndex > 0) {
                this.playSong(this.currentlyPlayingIndex - 1);
            } else {
                this.playSong(this.songs.length - 1);
            }
        },

        nextSong() {
            if (this.currentlyPlayingIndex < this.songs.length - 1) {
                this.playSong(this.currentlyPlayingIndex + 1);
            } else {
                this.playSong(0);
            }
        },

        updatePlaybar(status, songName) {
            const playButtonImg = document.getElementById('play');
            if (playButtonImg) {
                playButtonImg.src = status === 'playing' ? 'img/pause.svg' : 'img/play.svg';
            }
            if (songName) {
                this.updateSongInfo(songName);
            }
        },

        updateSongInfo(songName) {
            const songInfoDiv = document.querySelector('.songinfo');
            if (songInfoDiv) {
                songInfoDiv.textContent = songName;
            }
        },

        updateProgressBar() {
            if (!this.currentAudio || isNaN(this.currentAudio.duration)) return;

            const progressBar = document.querySelector('.seekbar .circle');
            const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100 || 0;
            progressBar.style.left = `${progress}%`;

            const songTime = document.querySelector('.songtime');
            const minutes = Math.floor(this.currentAudio.currentTime / 60).toString().padStart(2, '0');
            const seconds = Math.floor(this.currentAudio.currentTime % 60).toString().padStart(2, '0');
            if (songTime) {
                songTime.textContent = `${minutes}:${seconds}`;
            }

            const songDuration = document.querySelector('.song-duration');
            if (songDuration && this.currentAudio.duration) {
                const totalMinutes = Math.floor(this.currentAudio.duration / 60).toString().padStart(2, '0');
                const totalSeconds = Math.floor(this.currentAudio.duration % 60).toString().padStart(2, '0');
                songDuration.textContent = `${totalMinutes}:${totalSeconds}`;
            }
        },

        updatePlayButtonInList(status) {
            const currentButton = document.querySelector(`.play-btn[data-index="${this.currentlyPlayingIndex}"]`);
            if (currentButton) {
                currentButton.textContent = status;
            }
        },

        updatePlayButtons(index, status) {
            document.querySelectorAll('.play-btn').forEach((button) => {
                button.textContent = button.dataset.index === index.toString() ? status : 'Play';
            });
        },

        setupPlaybarControls() {
            const playButtonImg = document.getElementById('play');
            const previousButton = document.getElementById('previous');
            const nextButton = document.getElementById('next');

            if (!playButtonImg || !previousButton || !nextButton) {
                console.error('Playbar controls not found in DOM.');
                this.showError('Playbar controls not found.');
                return;
            }

            playButtonImg.addEventListener('click', () => this.playOrPause());
            previousButton.addEventListener('click', () => this.previousSong());
            nextButton.addEventListener('click', () => this.nextSong());

            const seekbar = document.querySelector('.seekbar');
            seekbar.addEventListener('mousedown', this.startSeeking.bind(this));
            document.addEventListener('mousemove', this.seek.bind(this));
            document.addEventListener('mouseup', this.stopSeeking.bind(this));
        },

        setupVolumeControl() {
            const volumeImg = document.querySelector(".volume>img");
            if (!volumeImg) {
                console.error('Volume image not found in DOM.');
                return;
            }

            volumeImg.addEventListener("click", (e) => {
                console.log('Volume icon clicked:', e.target.src);
                if (this.currentAudio) {
                    if (e.target.src.includes("volume.svg")) {
                        e.target.src = "img/mute.svg";
                        this.currentAudio.volume = 0;
                    } else {
                        e.target.src = "img/volume.svg";
                        this.currentAudio.volume = 0.1;
                    }
                } else {
                    console.log('No audio currently playing to mute/unmute.');
                }
            });
        },

        startSeeking(event) {
            if (!this.currentAudio) return;
            this.isSeeking = true;
            this.seek(event);
        },

        seek(event) {
            if (!this.isSeeking || !this.currentAudio || isNaN(this.currentAudio.duration)) return;

            const seekbar = document.querySelector('.seekbar');
            const rect = seekbar.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const totalWidth = rect.width;
            const percent = Math.max(0, Math.min(1, offsetX / totalWidth));
            const newTime = percent * this.currentAudio.duration;

            this.currentAudio.currentTime = newTime;
            this.updateProgressBar();
        },

        stopSeeking() {
            this.isSeeking = false;
        },

        showError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.prepend(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
        }
    };

    document.querySelector(".hamberger").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0";
    });

    document.querySelector(".cross").addEventListener("click", () => {
        document.querySelector(".left").style.left = "-110%";
    });

    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        if (musicLibrary.currentAudio) {
            musicLibrary.currentAudio.volume = parseInt(e.target.value) / 100;
            const volumeImg = document.querySelector(".volume>img");
            if (musicLibrary.currentAudio.volume > 0) {
                volumeImg.src = volumeImg.src.includes("mute.svg") ? "img/volume.svg" : volumeImg.src;
            } else {
                volumeImg.src = volumeImg.src.includes("volume.svg") ? "img/mute.svg" : volumeImg.src;
            }
        }
    });

    document.querySelector(".volume>img").addEventListener("click", e => {
        if (musicLibrary.currentAudio) {
            const rangeInput = document.querySelector(".range").getElementsByTagName("input")[0];
            if (e.target.src.includes("img/volume.svg")) { 
                e.target.src = "img/mute.svg";
                rangeInput.value = 0; 
                musicLibrary.currentAudio.volume = 0;
            } else {
                rangeInput.value = 10;
                e.target.src = "img/volume.svg";
                musicLibrary.currentAudio.volume = 0.1;
            }
        } else {
            console.log('No audio currently playing to mute/unmute.');
        }
    });

    // Playlist handling: Supports 'song', 'arijit-playlist', 'playlist-3', 'playlist-4', 'playlist-5', 'playlist-6', etc.
    Array.from(document.getElementsByClassName("card")).forEach(e => {
        e.addEventListener("click", async (item) => {
            console.log('Clicked playlist card:', item.currentTarget.dataset);
            const playlistFolder = item.currentTarget.dataset.songs;
            if (playlistFolder) {
                musicLibrary.updatePlaylistSongs(playlistFolder);
            } else {
                console.error('No playlist folder specified in data-songs');
                musicLibrary.showError('No playlist folder specified.');
            }
        });
    });

    musicLibrary.setupPlaybarControls();
    musicLibrary.setupVolumeControl();
    musicLibrary.fetchSongsFromFolder('song').then(() => {
        musicLibrary.renderSongList();
    }).catch(error => {
        console.error('Error during initial song fetch:', error);
        musicLibrary.showError('Failed to load initial songs.');
    });
});