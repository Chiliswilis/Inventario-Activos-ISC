const supabase = require('./supabase');

// Example function to test connection and fetch data
async function testConnection() {
  try {
    // Test connection by fetching from a table (assuming 'users' table exists)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error connecting to Supabase:', error);
    } else {
      console.log('Connected to Supabase successfully!');
      console.log('Sample data:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the test
testConnection();