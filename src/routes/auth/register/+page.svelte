<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let formData = $state({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    requestVerification: false
  });
  
  let error = $state('');
  let loading = $state(false);
  let success = $state(false);
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    
    try {
      // Create user profile in our database (includes password hashing)
      const profileResponse = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          address: formData.address || null,
          requestVerification: formData.requestVerification
        })
      });
      
      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        throw new Error(errorData.message || 'Failed to create account. Please try again.');
      }
      
      success = true;
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        const redirect = $page.url.searchParams.get('redirect') || '/dashboard';
        goto(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
      }, 2000);
      
    } catch (err) {
      console.error('Registration error:', err);
      error = err.message || 'An error occurred during registration. Please try again.';
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#f7f4ee] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center font-[family-name:var(--pumbi-serif)] text-4xl font-semibold text-[#1a2821]">
        Create your account
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Or
        <a href="/auth/login" class="font-medium text-[#18372f] hover:text-[#a95739]">
          sign in to your existing account
        </a>
      </p>
    </div>
    
    {#if success}
      <div class="bg-green-50 border border-green-200 rounded-sm p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-green-800 text-sm">Registration successful! Redirecting to login...</p>
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
          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Email address <span class="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              bind:value={formData.email}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="your@email.com"
            />
          </div>
          
          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
              Password <span class="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              bind:value={formData.password}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="Password"
            />
          </div>
          
          <!-- First Name -->
          <div>
            <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">
              First Name <span class="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autocomplete="given-name"
              required
              bind:value={formData.firstName}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="John"
            />
          </div>
          
          <!-- Last Name -->
          <div>
            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span class="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autocomplete="family-name"
              required
              bind:value={formData.lastName}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="Doe"
            />
          </div>
          
          <!-- Phone -->
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autocomplete="tel"
              bind:value={formData.phone}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          
          <!-- Address -->
          <div>
            <label for="address" class="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows="3"
              bind:value={formData.address}
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-sm focus:outline-none focus:ring-[#18372f] focus:border-[#18372f] focus:z-10 sm:text-sm"
              placeholder="123 Main St, City, State, ZIP"
            ></textarea>
          </div>
          
          <!-- Verification Request -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="requestVerification"
                name="requestVerification"
                type="checkbox"
                bind:checked={formData.requestVerification}
                class="h-4 w-4 text-[#18372f] focus:ring-[#18372f] border-gray-300 rounded"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="requestVerification" class="font-medium text-gray-700">
                Request Verified Buyer Status
              </label>
              <p class="text-gray-500">
                Check this box to request verification. Verified buyers can become verified bidders after their information is verified by our team.
              </p>
            </div>
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
              Creating account...
            {:else}
              Create account
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

