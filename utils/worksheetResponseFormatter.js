/**
 * Specialized JSON response formatter for worksheet analysis
 * This handles the specific structure and LaTeX formatting in worksheet analysis responses
 */

const cleanWorksheetAnalysisResponse = (response) => {
  console.log('Starting to clean worksheet analysis response...');
  
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
  
  // Try to find JSON content between curly braces
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0];
    console.log('Extracted JSON content between curly braces');
  }
  
  // Handle LaTeX specific issues - this is the key difference for worksheet analysis
  cleanedResponse = cleanedResponse
    // Properly escape LaTeX backslashes (very common in worksheet analysis)
    .replace(/\\\\frac/g, '\\\\\\\\frac')
    .replace(/\\\\cdot/g, '\\\\\\\\cdot')
    .replace(/\\\\sqrt/g, '\\\\\\\\sqrt')
    .replace(/\\\\mathbf/g, '\\\\\\\\mathbf')
    .replace(/\\\\text/g, '\\\\\\\\text')
    .replace(/\\\\int/g, '\\\\\\\\int')
    .replace(/\\\\sum/g, '\\\\\\\\sum')
    .replace(/\\\\left/g, '\\\\\\\\left')
    .replace(/\\\\right/g, '\\\\\\\\right')
    .replace(/\\\\times/g, '\\\\\\\\times')
    .replace(/\\\\div/g, '\\\\\\\\div')
    .replace(/\\\\pm/g, '\\\\\\\\pm')
    .replace(/\\\\alpha/g, '\\\\\\\\alpha')
    .replace(/\\\\beta/g, '\\\\\\\\beta')
    .replace(/\\\\gamma/g, '\\\\\\\\gamma')
    .replace(/\\\\delta/g, '\\\\\\\\delta')
    .replace(/\\\\theta/g, '\\\\\\\\theta')
    .replace(/\\\\pi/g, '\\\\\\\\pi')
    // Fix other LaTeX commands with similar pattern
    .replace(/\\\\([a-zA-Z]+)/g, '\\\\\\\\$1');
  
  // Try direct parsing after LaTeX fixes
  try {
    JSON.parse(cleanedResponse);
    console.log('JSON is valid after LaTeX fixes');
    return cleanedResponse;
  } catch (e) {
    console.log('LaTeX fixes not sufficient, applying standard JSON fixes...', e.message);
    
    // Apply standard JSON fixes
    try {
      let fixedResponse = cleanedResponse
        // Remove all newlines and extra whitespace
        .replace(/(\r\n|\n|\r)/gm, '')
        .replace(/\s+/g, ' ')
        // Remove trailing commas in objects and arrays
        .replace(/,(\s*[\}\]])/g, '$1')
        // Fix unquoted property names
        .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        // Fix boolean values in strings
        .replace(/"(true|false)"/g, '$1')
        // Fix missing commas between array items
        .replace(/}(\s*){/g, '},{')
        // Fix missing commas between object properties
        .replace(/"([^"]+)"(\s*)"([^"]+)"/g, '"$1","$3"')
        // Fix ellipsis in arrays (common in GPT responses)
        .replace(/\.\.\.\s*and\s*so\s*on\s*for\s*EACH\s*step/gi, '')
        .replace(/\.\.\.\s*repeat\s*for\s*each\s*question/gi, '')
        .trim();
      
      console.log('After standard fixes:', fixedResponse);
      
      // Try parsing after standard fixes
      JSON.parse(fixedResponse);
      console.log('Standard JSON fixes successful');
      return fixedResponse;
    } catch (e2) {
      console.log('Standard fixes not sufficient, attempting structural repairs...', e2.message);
      
      try {
        // More aggressive structural fixes
        let fixedResponse = cleanedResponse;
        
        // Check if we're missing the end of the JSON structure
        if (!fixedResponse.trim().endsWith('}')) {
          fixedResponse = fixedResponse.trim() + '}';
        }
        
        // Check for missing closing brackets in questionAnalyses array
        const questionAnalysesMatch = fixedResponse.match(/"questionAnalyses"\s*:\s*\[([^\]]*)/);
        if (questionAnalysesMatch && !questionAnalysesMatch[0].includes(']')) {
          fixedResponse = fixedResponse.replace(/"questionAnalyses"\s*:\s*\[([^\]]*)/g, '"questionAnalyses": [$1]');
        }
        
        // Check for missing closing brackets in stepByStepAnalysis array
        const stepByStepMatch = fixedResponse.match(/"stepByStepAnalysis"\s*:\s*\[([^\]]*)/g);
        if (stepByStepMatch) {
          stepByStepMatch.forEach(match => {
            if (!match.includes(']')) {
              fixedResponse = fixedResponse.replace(match, match + ']');
            }
          });
        }
        
        // Apply all standard fixes again after structural repairs
        fixedResponse = fixedResponse
          .replace(/(\r\n|\n|\r)/gm, '')
          .replace(/\s+/g, ' ')
          .replace(/,(\s*[\}\]])/g, '$1')
          .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/"(true|false)"/g, '$1')
          .replace(/}(\s*){/g, '},{')
          .replace(/"([^"]+)"(\s*)"([^"]+)"/g, '"$1","$3"')
          .trim();
        
        console.log('After structural repairs:', fixedResponse);
        
        // Try parsing after structural repairs
        JSON.parse(fixedResponse);
        console.log('Structural repairs successful');
        return fixedResponse;
      } catch (e3) {
        console.error('All parsing attempts failed:', e3.message);
        
        // If all else fails, create a minimal valid JSON structure
        // This is specific to the worksheet analysis format
        return `{
          "questionAnalyses": [],
          "strengthAreas": ["Unable to determine due to parsing error"],
          "improvementAreas": ["Unable to determine due to parsing error"]
        }`;
      }
    }
  }
};

module.exports = {
  cleanWorksheetAnalysisResponse
}; 