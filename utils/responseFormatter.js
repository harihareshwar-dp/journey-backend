const cleanGPTResponse = (response) => {
  // Remove markdown code blocks and any extra text
  let cleanedResponse = response;
  
  // Remove ```json or ``` at start
  cleanedResponse = cleanedResponse.replace(/^```(?:json)?\n/g, '');
  
  // Remove ``` at end
  cleanedResponse = cleanedResponse.replace(/\n```$/g, '');
  
  // Remove any additional backticks
  cleanedResponse = cleanedResponse.replace(/`/g, '');
  
  // Remove any leading/trailing whitespace
  cleanedResponse = cleanedResponse.trim();
  
  // Remove any BOM or special characters that might interfere with JSON parsing
  cleanedResponse = cleanedResponse.replace(/^\uFEFF/, '');
  
  // Try to find JSON content between curly braces
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0];
  }
  
  // Final cleanup: ensure proper JSON structure
  try {
    // Test if it's valid JSON
    JSON.parse(cleanedResponse);
    return cleanedResponse;
  } catch (e) {
    console.log('Initial JSON parse error:', e.message);
    console.log('Attempting to fix JSON formatting issues...');
    
    // Step 1: Fix common formatting issues
    try {
      let fixedResponse = cleanedResponse
        // Remove all newlines and extra whitespace
        .replace(/(\r\n|\n|\r)/gm, '')
        .replace(/\s+/g, ' ')
        // Remove trailing commas in objects and arrays
        .replace(/,(\s*[\}\]])/g, '$1')
        // Replace \n with actual spaces in string values
        .replace(/\\n/g, ' ')
        // Fix escaped quotes that shouldn't be escaped
        .replace(/\\"/g, '"')
        .replace(/"\s+"/g, '" "')
        .trim();
      
      // Try parsing after basic fixes
      JSON.parse(fixedResponse);
      return fixedResponse;
    } catch (e2) {
      console.log('Basic fixes not sufficient, trying more advanced repairs...');
      
      // Step 2: More aggressive fixing
      try {
        let fixedResponse = cleanedResponse
          // Fix unquoted property names (one of the most common issues)
          .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          // Fix incorrectly quoted boolean and number values
          .replace(/"(true|false|null|undefined)"/g, '$1')
          .replace(/"(\d+)"/g, '$1')
          // Remove trailing commas in arrays and objects
          .replace(/,(\s*\])/g, '$1')
          .replace(/,(\s*\})/g, '$1')
          // Remove all newlines and normalize whitespace
          .replace(/(\r\n|\n|\r)/gm, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Try parsing after advanced fixes
        JSON.parse(fixedResponse);
        return fixedResponse;
      } catch (e3) {
        // Log the problematic response for debugging
        console.error('Failed to parse JSON after multiple repair attempts');
        console.error('Original response:', response);
        console.error('Cleaned response:', cleanedResponse);
        
        // Just return the original cleaned response and let the caller handle the error
        throw new Error('Failed to parse GPT response after multiple repair attempts: ' + e3.message);
      }
    }
  }
};

module.exports = {
  cleanGPTResponse
}; 