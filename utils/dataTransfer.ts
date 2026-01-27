import { Activity } from '../types';

export const exportData = (activities: Activity[], filename = 'scripta-backup') => {
  const data = JSON.stringify(activities, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportActivity = (activity: Activity, format: 'txt' | 'md') => {
  let content = '';
  if (format === 'md') {
    content = `# ${activity.title}\n\n${activity.content}`;
  } else {
    content = `${activity.title}\n\n${activity.content}`;
  }
  
  const type = format === 'md' ? 'text/markdown' : 'text/plain';
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activity.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50) || 'untitled'}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseImportFile = (file: File): Promise<Activity[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        if (!result) throw new Error("File is empty");
        
        let data;
        try {
          data = JSON.parse(result);
        } catch (jsonError) {
          throw new Error("Invalid JSON format");
        }

        if (!Array.isArray(data)) {
           throw new Error("Invalid format: Root must be an array of activities");
        }
        
        // Strict validation of activities
        const validActivities: Activity[] = [];
        let skipped = 0;

        for (const item of data) {
           if (
             item && 
             typeof item.id === 'string' && 
             typeof item.title === 'string' && 
             (typeof item.content === 'string' || item.content === undefined)
           ) {
             // Sanitize/Normalize
             validActivities.push({
                ...item,
                content: item.content || '',
                updatedAt: item.updatedAt || new Date().toISOString(),
                createdAt: item.createdAt || new Date().toISOString(),
                wordCount: typeof item.wordCount === 'number' ? item.wordCount : 0,
                linkedActivityIds: Array.isArray(item.linkedActivityIds) ? item.linkedActivityIds : [],
                archived: !!item.archived,
                deleted: !!item.deleted
             });
           } else {
             skipped++;
           }
        }

        if (validActivities.length === 0) {
          throw new Error("No valid activities found in file");
        }

        console.log(`Parsed ${validActivities.length} activities, skipped ${skipped} invalid items.`);
        resolve(validActivities);

      } catch (err) {
        reject(err instanceof Error ? err : new Error("Unknown error during parsing"));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};