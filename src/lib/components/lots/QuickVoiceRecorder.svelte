<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  import { localeTag as uiLocaleTag } from '$lib/utils/region.js';
  const uiLocale = () => uiLocaleTag($localePage.data.locale);
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let {
    lotId = '',
    onNoteSaved = () => {},
    onRecordingComplete = () => {}
  } = $props();

  let isRecording = $state(false);
  let mediaRecorder = $state(null);
  let audioChunks = $state([]);
  let audioBlob = $state(null);
  let isUploading = $state(false);
  let isTranscribing = $state(false);
  let error = $state(null);
  let showModal = $state(false);
  let showNotes = $state(false);
  let notes = $state([]);
  let loadingNotes = $state(false);

  async function loadNotes() {
    if (!lotId) return;
    loadingNotes = true;
    try {
      const response = await fetch(`/api/lots/${lotId}/notes`, {
        credentials: 'include'
      });
      if (response.ok) {
        notes = await response.json();
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      loadingNotes = false;
    }
  }

  function openModal() {
    showModal = true;
    showNotes = true;
    loadNotes();
  }

  function startNewRecording() {
    showNotes = false;
    startRecording();
  }

  async function startRecording() {
    try {
      error = null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        audioBlob = blob;
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        // Auto-upload and transcribe (use setTimeout to ensure blob is set)
        setTimeout(() => {
          uploadAndTranscribe();
        }, 100);
      };

      mediaRecorder.start();
      isRecording = true;
    } catch (err) {
      console.error('Error starting recording:', err);
      error = ui("Failed to access microphone. Please check permissions.");
      showModal = false;
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
    }
  }

  async function uploadAndTranscribe() {
    // Wait a moment to ensure blob is ready
    if (!audioBlob || audioBlob.size === 0) {
      console.error('No audio blob available or blob is empty', { audioBlob, size: audioBlob?.size });
      error = ui("No audio recorded. Please try again.");
      isUploading = false;
      isTranscribing = false;
      showModal = false;
      return;
    }

    isUploading = true;
    isTranscribing = false; // Will be set to true after upload succeeds
    error = null;

    try {
      // Upload the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice-note-${Date.now()}.webm`);

      const uploadResponse = await fetch(`/api/lots/${lotId}/notes/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText || ui("Unknown error") } };
        }
        throw new Error(errorData.error?.message || ui("Failed to upload audio"));
      }

      const { noteId } = await uploadResponse.json();

      // Now start transcribing
      isTranscribing = true;
      isUploading = false;

      // Transcribe
      const transcribeResponse = await fetch(`/api/lots/${lotId}/notes/${noteId}/transcribe`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({ error: { message: ui("Unknown error") } }));
        throw new Error(errorData.error?.message || ui("Failed to transcribe audio"));
      }

      const result = await transcribeResponse.json();
      
      // Reset state
      audioBlob = null;
      
      // Reload notes and show notes view
      await loadNotes();
      showNotes = true;

      // Notify parent
      onNoteSaved(result);
      onRecordingComplete();

      // Auto-summarize
      await summarizeNote(noteId);
    } catch (err) {
      console.error('Error uploading/transcribing:', err);
      error = err.message || ui("Failed to upload and transcribe audio");
    } finally {
      isUploading = false;
      isTranscribing = false;
    }
  }

  async function summarizeNote(noteId) {
    try {
      const response = await fetch(`/api/lots/${lotId}/notes/${noteId}/summarize`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to summarize note');
        return;
      }

      const result = await response.json();
      onNoteSaved(result);
    } catch (err) {
      console.error('Error summarizing note:', err);
    }
  }

  function cancelRecording() {
    if (isRecording) {
      stopRecording();
    }
    audioBlob = null;
    error = null;
    // If we're in recording mode, go back to notes view, otherwise close modal
    if (isRecording || isUploading || isTranscribing) {
      showNotes = false;
    } else {
      showModal = false;
      showNotes = false;
    }
  }

  function closeModal() {
    if (!isRecording && !isUploading && !isTranscribing) {
      showModal = false;
      showNotes = false;
    }
  }
</script>

<button
  type="button"
  onclick={openModal}
  class="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
  title={ui("Voice notes")}
  disabled={isRecording || isUploading || isTranscribing}
>
  {#if isRecording}
    <svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
    </svg>
  {:else if isUploading || isTranscribing}
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  {:else}
    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
    </svg>
  {/if}
</button>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget && !isRecording) {
        cancelRecording();
      }
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape' && !isRecording) {
        cancelRecording();
      }
    }}
  >
    <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">{ui("Voice Notes")}</h3>
        <button
          type="button"
          onclick={closeModal}
          class="text-gray-400 hover:text-gray-600"
          disabled={isRecording || isUploading || isTranscribing}
          aria-label={ui("Close")}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if showNotes && !isRecording && !isUploading && !isTranscribing}
        <!-- Notes List View -->
        <div class="space-y-3">
          <button
            type="button"
            onclick={startNewRecording}
            class="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
            </svg>
            {ui("New Recording")}
          </button>

          {#if loadingNotes}
            <div class="text-center py-4 text-sm text-gray-500">{ui("Loading notes...")}</div>
          {:else if notes.length === 0}
            <div class="text-center py-4 text-sm text-gray-500">{ui("No voice notes yet. Click \"New Recording\" to get started.")}</div>
          {:else}
            <div class="space-y-2 max-h-64 overflow-y-auto">
              {#each notes as note}
                <div class="border border-gray-200 rounded-lg p-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      {#if note.audioUrl}
                        <audio src={note.audioUrl} controls class="w-full mb-2" preload="metadata"></audio>
                      {/if}
                      {#if note.summary}
                        <p class="text-sm text-gray-700 font-medium mb-1">{note.summary}</p>
                      {/if}
                      {#if note.transcription}
                        <p class="text-xs text-gray-600">{note.transcription}</p>
                      {:else if note.content}
                        <p class="text-xs text-gray-600">{note.content}</p>
                      {/if}
                      <p class="text-xs text-gray-400 mt-1">
                        {new Date(note.createdAt).toLocaleString(uiLocale())}
                      </p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Recording/Processing View -->
        <div class="text-center">
          {#if isRecording}
            <div class="mb-4">
              <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div class="w-8 h-8 bg-red-600 rounded-full animate-pulse"></div>
              </div>
              <p class="text-lg font-medium text-gray-900">{ui("Recording...")}</p>
              <p class="text-sm text-gray-500 mt-1">{ui("Click stop when finished")}</p>
            </div>
            <button
              type="button"
              onclick={stopRecording}
              class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              {ui("Stop Recording")}
            </button>
          {:else if isUploading}
          <div class="mb-4">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p class="text-lg font-medium text-gray-900">{ui("Uploading...")}</p>
          </div>
        {:else if isTranscribing}
          <div class="mb-4">
            <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-purple-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p class="text-lg font-medium text-gray-900">{ui("Transcribing...")}</p>
          </div>
        {/if}
        
        {#if error}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
            {ui(error)}
          </div>
        {/if}
        
          {#if !isRecording && !isUploading && !isTranscribing}
            <button
              type="button"
              onclick={cancelRecording}
              class="mt-4 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              {ui("Close")}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

