<script>
  import { goto } from '$app/navigation';
  
  // Get session data
  let session = $state(null);
  
  $effect(async () => {
    try {
      const res = await fetch('/auth/session');
      const data = await res.json();
      session = data;
      if (data?.user) {
        const pending = sessionStorage.getItem('pendingAuctionHouseSignup');
        if (pending) {
          try {
            Object.assign(formData, JSON.parse(pending));
            sessionStorage.removeItem('pendingAuctionHouseSignup');
            queueMicrotask(() => handleSubmit());
          } catch {
            sessionStorage.removeItem('pendingAuctionHouseSignup');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  });
  
  let formData = $state({
    name: '',
    slug: '',
    description: '',
    domain: '',
    logoUrl: '',
    // User creation fields (only needed if not logged in)
    userEmail: '',
    userFirstName: '',
    userLastName: '',
    userPassword: ''
  });
  
  let errors = $state({});
  let loading = $state(false);
  let success = $state(false);
  let successText = $state('');
  let errorMessage = $state('');
  let isLoggedIn = $derived(!!session?.user);
  
  // Auto-generate slug from name
  function generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
  
  $effect(() => {
    if (formData.name && !formData.slug) {
      formData.slug = generateSlug(formData.name);
    }
  });
  
  async function handleSubmit() {
    errors = {};
    errorMessage = '';
    loading = true;
    
    try {
      // Clean up empty strings to null
      const submitData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() || null,
        domain: formData.domain.trim() || null,
        logoUrl: formData.logoUrl.trim() || null
      };
      
      // Add user creation fields if not logged in
      if (!isLoggedIn) {
        if (!formData.userEmail || !formData.userFirstName || !formData.userLastName || !formData.userPassword) {
          errorMessage = 'First name, last name, email, and password are required to create your account.';
          loading = false;
          return;
        }
        
        submitData.userEmail = formData.userEmail.trim().toLowerCase();
        submitData.userName = `${formData.userFirstName.trim()} ${formData.userLastName.trim()}`;
        submitData.userFirstName = formData.userFirstName.trim();
        submitData.userLastName = formData.userLastName.trim();
        submitData.userPassword = formData.userPassword;

        const registration = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: submitData.userEmail,
            password: submitData.userPassword,
            firstName: submitData.userFirstName,
            lastName: submitData.userLastName
          })
        });
        const registrationData = await registration.json().catch(() => ({}));
        if (!registration.ok) {
          errorMessage = registrationData.message || registrationData.error || 'Failed to create your account.';
          loading = false;
          return;
        }
        sessionStorage.setItem('pendingAuctionHouseSignup', JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          domain: formData.domain,
          logoUrl: formData.logoUrl
        }));
        success = true;
        successText = 'Your account is ready. Sign in once to securely link and create your company.';
        setTimeout(() => goto(`/auth/login?redirect=${encodeURIComponent('/auction-houses/signup?complete=1')}`), 1200);
        return;
      }
      
      const response = await fetch('/api/auction-houses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        if (data.message || data.error) {
          errorMessage = data.message || data.error;
        } else {
          errorMessage = 'Failed to create auction house. Please try again.';
        }
        loading = false;
        return;
      }
      
      // Success!
      success = true;
      successText = 'Your company is linked. Continue onboarding to request approval; access remains limited until Pumbi approves it.';
      
      setTimeout(() => {
        goto('/seller/onboarding');
      }, 1500);
      
    } catch (err) {
      console.error('Error submitting form:', err);
      errorMessage = 'An unexpected error occurred. Please try again.';
      loading = false;
    }
  }
  
  function validateSlug(slug) {
    if (!slug) return 'Slug is required';
    if (slug.length < 3) return 'Slug must be at least 3 characters';
    if (slug.length > 50) return 'Slug must be less than 50 characters';
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    return null;
  }
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">Register Your Auction House</h1>
      <p class="text-lg text-gray-600">
        Join Pumbi and start hosting your own auctions
      </p>
    </div>
    
    <!-- Success Message -->
    {#if success}
      <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div class="flex items-center">
          <svg class="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-lg font-semibold text-green-900">Company account created</h3>
            <p class="text-green-700">{successText}</p>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Error Message -->
    {#if errorMessage}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-red-800">{errorMessage}</p>
        </div>
      </div>
    {/if}
    
    <!-- Form -->
    {#if !success}
      <div class="bg-white shadow-lg rounded-lg p-8">
        <form onsubmit={(e) => {
            e.preventDefault();
            handleSubmit()
        }} class="space-y-6">
          <!-- Auction House Name -->
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
              Company name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              bind:value={formData.name}
              required
              minlength="3"
              maxlength="100"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Heritage Judaica Auctions"
            />
            {#if errors.name}
              <p class="mt-1 text-sm text-red-600">{errors.name}</p>
            {/if}
          </div>
          
          <!-- Slug -->
          <div>
            <label for="slug" class="block text-sm font-medium text-gray-700 mb-2">
              URL Slug <span class="text-red-500">*</span>
            </label>
            <div class="flex items-center">
              <span class="text-gray-500 mr-2">pumbi.com/</span>
              <input
                type="text"
                id="slug"
                bind:value={formData.slug}
                required
                minlength="3"
                maxlength="50"
                pattern="[a-z0-9-]+"
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="heritage-judaica"
                oninput={() => {
                  formData.slug = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  const slugError = validateSlug(formData.slug);
                  if (slugError) {
                    errors.slug = slugError;
                  } else {
                    delete errors.slug;
                  }
                }}
              />
            </div>
            <p class="mt-1 text-sm text-gray-500">
              This will be your unique URL identifier. Only lowercase letters, numbers, and hyphens.
            </p>
            {#if errors.slug}
              <p class="mt-1 text-sm text-red-600">{errors.slug}</p>
            {/if}
          </div>
          
          <!-- Description -->
          <div>
            <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              bind:value={formData.description}
              rows="4"
              maxlength="500"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Tell us about your auction house..."
            ></textarea>
            <p class="mt-1 text-sm text-gray-500">
              {formData.description.length}/500 characters
            </p>
          </div>
          
          <!-- Custom Domain (Optional) -->
          <div>
            <label for="domain" class="block text-sm font-medium text-gray-700 mb-2">
              Custom Domain (Optional)
            </label>
            <input
              type="text"
              id="domain"
              bind:value={formData.domain}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="auctions.yourdomain.com"
            />
            <p class="mt-1 text-sm text-gray-500">
              If you have a custom domain, you can use it for your auction house.
            </p>
          </div>
          
          <!-- Logo URL (Optional) -->
          <div>
            <label for="logoUrl" class="block text-sm font-medium text-gray-700 mb-2">
              Logo URL (Optional)
            </label>
            <input
              type="url"
              id="logoUrl"
              bind:value={formData.logoUrl}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/logo.png"
            />
            <p class="mt-1 text-sm text-gray-500">
              URL to your auction house logo image.
            </p>
          </div>
          
          <!-- User Account Section (only shown if not logged in) -->
          {#if !isLoggedIn}
            <div class="pt-6 border-t border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Create Your Account</h3>
              <p class="text-sm text-gray-600 mb-4">
                Create an account to manage your auction house. 
                <a href="/auth/login" class="text-blue-600 hover:text-blue-800 font-medium">Already have an account? Log in</a>
              </p>
              
              <!-- Email -->
              <div class="mb-4">
                <label for="userEmail" class="block text-sm font-medium text-gray-700 mb-2">
                  Email <span class="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="userEmail"
                  bind:value={formData.userEmail}
                  required={!isLoggedIn}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                />
                {#if errors.userEmail}
                  <p class="mt-1 text-sm text-red-600">{errors.userEmail}</p>
                {/if}
              </div>
              
              <!-- First Name -->
              <div class="mb-4">
                <label for="userFirstName" class="block text-sm font-medium text-gray-700 mb-2">
                  First name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="userFirstName"
                  bind:value={formData.userFirstName}
                  required={!isLoggedIn}
                  autocomplete="given-name"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John"
                />
              </div>
              
              <!-- Last Name -->
              <div class="mb-4">
                <label for="userLastName" class="block text-sm font-medium text-gray-700 mb-2">
                  Last name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="userLastName"
                  bind:value={formData.userLastName}
                  required={!isLoggedIn}
                  autocomplete="family-name"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Doe"
                />
              </div>
              
              <!-- Password -->
              <div class="mb-4">
                <label for="userPassword" class="block text-sm font-medium text-gray-700 mb-2">
                  Password <span class="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="userPassword"
                  bind:value={formData.userPassword}
                  required={!isLoggedIn}
                  minlength="8"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="At least 8 characters"
                />
                <p class="mt-1 text-sm text-gray-500">
                  Password must be at least 8 characters long.
                </p>
                {#if errors.userPassword}
                  <p class="mt-1 text-sm text-red-600">{errors.userPassword}</p>
                {/if}
              </div>
              
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p class="text-sm text-yellow-800">
                  Your account and company will be linked. Auction creation, payouts, and other seller tools remain limited until onboarding is reviewed and approved.
                </p>
              </div>
            </div>
          {:else}
            <!-- Logged in user info -->
            <div class="pt-6 border-t border-gray-200">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p class="text-sm text-blue-800">
                  <strong>Logged in as:</strong> {session?.user?.email || session?.user?.name}
                </p>
                <p class="text-xs text-blue-600 mt-1">
                  Your auction house will be linked to this account.
                </p>
              </div>
            </div>
          {/if}
          
          <!-- Submit Button -->
          <div class="pt-4">
            <button
              type="submit"
              disabled={loading}
              class="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {#if loading}
                <span class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Auction House...
                </span>
              {:else}
                Create Auction House
              {/if}
            </button>
          </div>
          
          <!-- Help Text -->
          <div class="pt-4 border-t border-gray-200">
            <p class="text-sm text-gray-600 text-center">
              Already have an auction house? 
              <a href="/" class="text-blue-600 hover:text-blue-800 font-medium">Go to homepage</a>
            </p>
          </div>
        </form>
      </div>
    {/if}
  </div>
</div>

