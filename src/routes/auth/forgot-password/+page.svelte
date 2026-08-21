<script>
  import { goto } from '$app/navigation';
  
  let email = $state('');
  let error = $state('');
  let success = $state(false);
  let loading = $state(false);
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send password reset email. Please try again.');
      }
      
      success = true;
    } catch (err) {
      console.error('Forgot password error:', err);
      error = err.message || 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center font-[family-name:var(--pumbi-serif)] text-4xl font-semibold text-[#1a2821]">
        Reset your password
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your email address and we'll send you a link to reset your password.
      </p>
    </div>
    
    {#if success}
      <div class="bg-green-50 border border-green-200 rounded-sm p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-green-800 text-sm font-semibold">Password reset email sent!</p>
            <p class="text-green-700 text-sm mt-1">
              Check your email for instructions to reset your password. If you don't see it, check your spam folder.
            </p>
          </div>
        </div>
      </div>
      <div class="text-center">
        <a href="/auth/login" class="text-sm font-medium text-[#18372f] hover:text-[#a95739]">
          Back to login
        </a>
      </div>
    {:else}
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-sm p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      {/if}
      
      <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-sm text-white bg-[#18372f] hover:bg-[#152c26] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#18372f] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            {:else}
              Send reset link
            {/if}
          </button>
        </div>
        
        <div class="text-center">
          <a href="/auth/login" class="text-sm font-medium text-[#18372f] hover:text-[#a95739]">
            Back to login
          </a>
        </div>
      </form>
    {/if}
  </div>
</div>

