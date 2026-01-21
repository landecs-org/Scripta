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
        const data = JSON.parse(result);
        if (Array.isArray(data)) {
          // Basic validation
          const valid = data.every(item => item.id && typeof item.title === 'string' && typeof item.content === 'string');
          if (valid) resolve(data);
          else reject(new Error('Invalid data format'));
        } else {
          reject(new Error('Invalid data format'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};