<script>
  let message = $state('Hello from SvelteKit!');
</script>

<div class="container">
  <h1>⏱ Family Time Log</h1>
  <p>{message}</p>
  <p>If you see this, the app is deployed correctly.</p>
</div>

<style>
  .container {
    max-width: 600px;
    margin: 60px auto;
    padding: 40px;
    text-align: center;
    font-family: system-ui, sans-serif;
  }
  h1 { color: #4c1d95; }
</style>
