<script>
  import { goto } from '$app/navigation';
  import { signIn } from '@auth/sveltekit/client';
  
  let formData = $state({
    email: '',
    password: ''
  });
  
  let error = $state('');
  let loading = $state(false);
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    
    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      });
      
      if (result?.error) {
        error = result.error === 'CredentialsSignin' 
          ? 'Invalid email or password. Please try again.'
          : result.error;
        loading = false;
      } else if (result?.ok || result?.url) {
        // Login successful - check session and redirect
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure session is set
        const sessionRes = await fetch('/auth/session');
        const session = await sessionRes.json();
        
        if (session?.user) {
          goto('/dashboard');
        } else {
          // Session not set yet, try redirect anyway
          window.location.href = '/dashboard';
        }
      } else {
        // Fallback - try to redirect after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      }
    } catch (err) {
      console.error('Login error:', err);
      error = 'An error occurred during login. Please try again.';
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center font-[family-name:var(--pumbi-serif)] text-4xl font-semibold text-[#1a2821]">
        Sign in to your account
      </h2>
      <p class="mt-2 text-center text-sm text-[#435048]">
        Don't have an account?
        <a href="/auth/register" class="pumbi-link">
          Register here
        </a>
        <span class="mx-2">|</span>
        <a href="/auction-houses/signup" class="pumbi-link">
          Register auction house
        </a>
      </p>
    </div>
    
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    {/if}
    
    <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="email" class="sr-only">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={formData.email}
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
          />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={formData.password}
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Password"
          />
        </div>
      </div>

      <div class="flex items-center justify-end">
        <div class="text-sm">
          <a href="/auth/forgot-password" class="font-medium text-[#18372f] hover:text-[#a95739]">
            Forgot your password?
          </a>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#18372f] hover:bg-[#152c26] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing in...
          {:else}
            Sign in
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

