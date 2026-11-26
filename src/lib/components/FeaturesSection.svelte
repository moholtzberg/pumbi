<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

    // import {
    //   ShoppingCartIcon,
    //   CurrencyDollarIcon,
    //   UserGroupIcon,
    //   CreditCardIcon,
    //   CogIcon,
    //   EmojiHappyIcon,
    //   TicketIcon,
    // } from 'svelte-hero-icons';
  
    // Define the list of features with Heroicons
    const features = [
      {
        title: ui("Supply Order Management"),
        description: ui("Efficiently manage your supply orders with real-time tracking and streamlined processes."),
        icon: "📋",
      },
      {
        title: ui("Inventory Management"),
        description: ui("Keep track of your inventory levels, automate stock replenishment, and reduce holding costs."),
        icon: "🛒",
      },
      {
        title: ui("Purchasing"),
        description: ui("Simplify your purchasing processes with automated workflows and vendor management."),
        icon: "💲",
      },
      {
        title: ui("Service Contracts"),
        description: ui("Manage service contracts effortlessly with automated renewals and billing."),
        icon: "🤝",
      },
      {
        title: ui("Smart Purchasing"),
        description: ui("Automatically purchase items from the cheapest vendor, eliminating the need to manually shop around."),
        icon: "🧠",
      },
      {
        title: ui("Automatic Service Contract Billing"),
        description: ui("Set it and forget it with automated billing for service contracts."),
        icon: "💡",
      },
      {
        title: ui("Simple UI for Placing Orders and Service Calls"),
        description: ui("User-friendly interface that makes placing supply orders and service calls a breeze."),
        icon: "🙂",
      },
      {
        title: ui("Customer Portal"),
        description: ui("Provide your customers with a dedicated portal to track orders, service requests, and more."),
        icon: "👨‍💻",
      },
      {
        title: ui("Integrated Payment Processing"),
        description: ui("Seamlessly process payments with integrated gateways for faster transactions."),
        icon: "💳",
      },
      {
        title: ui("Knowledge Base"),
        description: ui("Maintain a comprehensive knowledge base to empower your team and customers."),
        icon: "📖",
      },
      {
        title: ui("Omnichannel Customer Communications"),
        description: ui("Engage with customers across multiple channels, ensuring consistent and efficient communication."),
        icon: "💬",
      },
      {
        title: ui("Flexible Workflows"),
        description: ui("Customize workflows to match your unique business processes and operational needs."),
        icon: "⚙️",
      },
      {
        title: ui("Automated Customer Feedback & Reviews"),
        description: ui("Automatically request customer feedback and reviews when service calls are closed or supplies are received."),
        icon: "😀",
      },
      {
        title: ui("Ticketing System with Integrated AI"),
        description: ui("Manage customer inquiries and support tickets efficiently with AI-powered assistance."),
        icon: "🎟️",
      },
      // Add more features as needed
    ];
</script>
  
<section id="features" class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-4xl font-bold text-center mb-12 text-gray-800">{ui("✨ Features")}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-12">
        {#each features as feature}
          <div class="flex flex-col items-center text-center p-6 bg-gray-50 rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
            <span class="text-4xl mb-4">{feature.icon}</span>
            <h3 class="text-2xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
            <p class="text-gray-600">{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
</section>

<div class="mt-16 text-center my-16">
    <p class="text-gray-200 text-xl">{ui("Still using outdated systems?")} <br/>{ui("Discover how DealerEdge can transform your dealership operations with modern, efficient, and scalable solutions.")}</p>
    <button
      class="mt-16 bg-slate-200 text-gray-800 px-6 py-3 rounded-md hover:bg-slate-700 transition-colors"
      on:click={() => dispatch('openModal')}
    >
      {ui("Learn More")}
    </button>
</div>
