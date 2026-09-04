export const exportToJSON = (jobs) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jobs, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `job_tracker_export_${new Date().toISOString().split('T')[0]}.json`);
  dlAnchorElem.click();
  dlAnchorElem.remove();
};

export const exportToCSV = (jobs) => {
  if (!jobs || jobs.length === 0) return;
  const headers = ['id', 'company', 'title', 'location', 'status', 'date', 'salary', 'link'];
  const csvRows = [
    headers.join(','),
    ...jobs.map(job => headers.map(h => {
      let val = job[h] || '';
      if (typeof val === 'string') {
        val = val.replace(/"/g, '""');
        if (val.includes(',') || val.includes('\n')) val = `"${val}"`;
      }
      return val;
    }).join(','))
  ];
  const csvStr = csvRows.join('\n');
  const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvStr);
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `job_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
  dlAnchorElem.click();
  dlAnchorElem.remove();
};

export const parseImportFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let parsed = [];
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error('JSON must be an array of jobs.');
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) throw new Error('CSV is empty or missing data.');
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const obj = {};
            headers.forEach((h, index) => {
              let val = values[index] || '';
              if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
              obj[h] = val;
            });
            parsed.push(obj);
          }
        } else {
          throw new Error('Unsupported file format. Please use JSON or CSV.');
        }
        
        // Basic schema validation
        const validJobs = parsed.filter(j => j.company && j.title).map(j => ({
          ...j,
          id: j.id || Date.now().toString() + Math.random().toString(36).substring(7),
          status: j.status || 'Discovered',
          date: j.date || new Date().toISOString()
        }));
        
        resolve(validJobs);
      } catch (err) {
        reject(err.message);
      }
    };
    reader.onerror = () => reject('Failed to read file.');
    reader.readAsText(file);
  });
};

export const generateICS = (job, dateStr) => {
  // Simple ICS generator for an interview
  const dtstart = new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtend = new Date(new Date(dateStr).getTime() + 60*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // 1 hr later
  
  const icsString = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Dashboard//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:Interview with ${job.company} - ${job.title}`,
    `DESCRIPTION:Job application interview. Link: ${job.link || ''}`,
    `LOCATION:${job.location || 'Remote'}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  const dataStr = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsString);
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `interview_${job.company.replace(/\s+/g, '_')}.ics`);
  dlAnchorElem.click();
  dlAnchorElem.remove();
};
