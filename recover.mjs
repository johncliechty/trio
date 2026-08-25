import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\john\\.gemini\\antigravity-cli\\brain';
const targetPrefix = 'C:\\dev\\trio\\researchPrime';
const todayStr = '2026-07-16';

function findTranscripts(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findTranscripts(filePath));
    } else if (file === 'transcript.jsonl' || file === 'transcript_full.jsonl') {
       if (stat.mtime.toISOString().startsWith(todayStr)) {
          if (file === 'transcript_full.jsonl') { // Prefer full
            results.push({path: filePath, mtime: stat.mtimeMs});
          }
       }
    }
  }
  return results;
}

let transcripts = findTranscripts(brainDir);
transcripts.sort((a, b) => a.mtime - b.mtime);

console.log(`Found ${transcripts.length} transcripts`);

// To avoid duplicate processing, just use transcript_full.jsonl
transcripts = transcripts.filter(t => t.path.endsWith('transcript_full.jsonl'));

let actions = [];

for (const t of transcripts) {
  const lines = fs.readFileSync(t.path, 'utf8').split('\n').filter(l => l.trim() !== '');
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        for (const call of obj.tool_calls) {
          if (call.name === 'write_to_file' || call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
            const args = call.args;
            if (args.TargetFile && args.TargetFile.startsWith(targetPrefix)) {
              actions.push({
                time: obj.created_at,
                name: call.name,
                args: args
              });
            }
          }
        }
      }
    } catch (e) {}
  }
}

// Sort actions chronologically
actions.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

console.log(`Found ${actions.length} file modification actions`);

for (const action of actions) {
  console.log(`[${action.time}] Applying ${action.name} to ${action.args.TargetFile}`);
  const target = action.args.TargetFile;
  
  // Ensure dir exists
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (action.name === 'write_to_file') {
    if (action.args.Overwrite || !fs.existsSync(target)) {
      fs.writeFileSync(target, action.args.CodeContent, 'utf8');
    } else {
       console.log('Skipping write_to_file (exists and !overwrite)');
    }
  } else if (action.name === 'replace_file_content') {
    if (!fs.existsSync(target)) {
       console.log(`Warning: replace_file_content but file doesn't exist: ${target}`);
       continue;
    }
    let content = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    
    const targetContent = action.args.TargetContent.replace(/\r\n/g, '\n');
    const replacementContent = action.args.ReplacementContent.replace(/\r\n/g, '\n');
    
    if (content.includes(targetContent)) {
       content = content.replace(targetContent, replacementContent);
       fs.writeFileSync(target, content, 'utf8');
    } else {
       console.log(`Warning: TargetContent not found in ${target}`);
    }
  } else if (action.name === 'multi_replace_file_content') {
    if (!fs.existsSync(target)) {
       console.log(`Warning: multi_replace_file_content but file doesn't exist: ${target}`);
       continue;
    }
    let content = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    let modified = false;
    for (const chunk of action.args.ReplacementChunks) {
      const targetChunk = chunk.TargetContent.replace(/\r\n/g, '\n');
      const replaceChunk = chunk.ReplacementContent.replace(/\r\n/g, '\n');
      if (content.includes(targetChunk)) {
        content = content.replace(targetChunk, replaceChunk);
        modified = true;
      } else {
        console.log(`Warning: TargetContent not found for a chunk in ${target}`);
      }
    }
    if (modified) fs.writeFileSync(target, content, 'utf8');
  }
}

console.log('Done recovering files.');
