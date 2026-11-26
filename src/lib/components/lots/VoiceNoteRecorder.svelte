<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  let {
    lotId = '',
    onNoteSaved = () => {}
  } = $props();

  let isRecording = $state(false);
  let mediaRecorder = $state(null);
  let audioChunks = $state([]);
  let audioBlob = $state(null);
  let audioUrl = $state(null);
  let isUploading = $state(false);
  let isTranscribing = $state(false);
  let error = $state(null);
  let showUploadOption = $state(false);

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
        audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioUrl = URL.createObjectURL(audioBlob);
        showUploadOption = true;
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      isRecording = true;
    } catch (err) {
      console.error('Error starting recording:', err);
      error = ui("Failed to access microphone. Please check permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
    }
  }

  async function uploadAndTranscribe() {
    if (!audioBlob) return;

    isUploading = true;
    isTranscribing = true;
    error = null;

    try {
      // First, upload the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice-note-${Date.now()}.webm`);

      const uploadResponse = await fetch(`/api/lots/${lotId}/notes/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(ui("Failed to upload audio"));
      }

      const { noteId } = await uploadResponse.json();

      // Then transcribe
      const transcribeResponse = await fetch(`/api/lots/${lotId}/notes/${noteId}/transcribe`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!transcribeResponse.ok) {
        throw new Error(ui("Failed to transcribe audio"));
      }

      const result = await transcribeResponse.json();
      
      // Reset state
      audioBlob = null;
      audioUrl = null;
      showUploadOption = false;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Notify parent
      onNoteSaved(result);

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
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    showUploadOption = false;
    error = null;
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      error = ui("Please select an audio file");
      return;
    }

    audioBlob = file;
    audioUrl = URL.createObjectURL(file);
    showUploadOption = true;
  }
</script>

<div class="space-y-3">
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
      {ui(error)}
    </div>
  {/if}

  <div class="flex items-center gap-2">
    {#if !isRecording && !showUploadOption}
      <button
        type="button"
        onclick={startRecording}
        class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
        </svg>
        {ui("Record Voice Note")}
      </button>

      <label class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium cursor-pointer">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {ui("Upload Audio")}
        <input
          type="file"
          accept="audio/*"
          onchange={handleFileUpload}
          class="hidden"
        />
      </label>
    {:else if isRecording}
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
          <span class="text-sm text-gray-700 font-medium">{ui("Recording...")}</span>
        </div>
        <button
          type="button"
          onclick={stopRecording}
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          {ui("Stop")}
        </button>
        <button
          type="button"
          onclick={cancelRecording}
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
        >
          {ui("Cancel")}
        </button>
      </div>
    {:else if showUploadOption}
      <div class="flex items-center gap-3 w-full">
        {#if audioUrl}
          <audio src={audioUrl} controls class="flex-1"></audio>
        {/if}
        <button
          type="button"
          onclick={uploadAndTranscribe}
          disabled={isUploading || isTranscribing}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {#if isUploading}
            {ui("Uploading...")}
          {:else if isTranscribing}
            {ui("Transcribing...")}
          {:else}
            {ui("Save & Transcribe")}
          {/if}
        </button>
        <button
          type="button"
          onclick={cancelRecording}
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
        >
          {ui("Cancel")}
        </button>
      </div>
    {/if}
  </div>
</div>

