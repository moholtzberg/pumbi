<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let formData = $state({
    password: '',
    passwordConfirm: ''
  });
  
  let error = $state('');
  let success = $state(false);
  let loading = $state(false);
  
  // Get token from URL query params
  let token = $derived($page.url.searchParams.get('token') || '');
  let email = $derived($page.url.searchParams.get('email') || '');
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    
    if (formData.password !== formData.passwordConfirm) {
      error = 'Passwords do not match';
      return;
    }
    
    if (formData.password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }
    
    loading = true;
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          token: token,
          password: formData.password,
          password_confirmation: formData.passwordConfirm
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password. Please try again.');
      }
      
      success = true;
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        goto('/auth/login');
      }, 2000);
      
    } catch (err) {
      console.error('Reset password error:', err);
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
        Enter your new password below.
      </p>
    </div>
    
    {#if !token || !email}
      <div class="bg-red-50 border border-red-200 rounded-sm p-4">
        <p class="text-red-800 text-sm">Invalid or missing reset token. Please request a new password reset link.</p>
      </div>
      <div class="text-center">
        <a href="/auth/forgot-password" class="text-sm font-medium text-[#18372f] hover:text-[#a95739]">
          Request new reset link
        </a>
      </div>
    {:else if success}
      <div class="bg-green-50 border border-green-200 rounded-sm p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-green-800 text-sm font-semibold">Password reset successful! Redirecting to login...</p>
        </div>
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
        <div class="space-y-4">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              bind:value={formData.password}
              minlength="8"
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="Enter new password"
            />
            <p class="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
          </div>
          
          <div>
            <label for="passwordConfirm" class="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autocomplete="new-password"
              required
              bind:value={formData.passwordConfirm}
              minlength="8"
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="Confirm new password"
            />
          </div>
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
              Resetting...
            {:else}
              Reset password
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

