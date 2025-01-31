import React from "react";

interface ReportSettingsProps {
  changeSettings: (setting: string) => void;
}

const ReportSettings: React.FC<ReportSettingsProps> = ({changeSettings}) => {

  return (
    <>
      <h3 className="font-bold uppercase text-slate-300 text-xs pt-6 pb-1">Report Settings</h3>

      <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50 w-full text-left"
        onClick={() => changeSettings('SOURCES')}
      >
        <img src="/images/magnifying-glass.svg" className="inline  align-bottom" />
        <span className="pl-3">Sources</span>
      </button>
      <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
        onClick={() => changeSettings('TIMING')}
      >
        <img src="/images/calendar.svg" className="inline  align-bottom" />
        <span className="pl-3">Timing</span>
      </button>

      <h3 className="font-bold uppercase text-slate-300 text-xs pt-4 pb-1">Global Settings</h3>

      <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
        onClick={() => changeSettings('TEAMS')}
      >
        <img src="/images/team.svg" className="inline align-bottom" />
        <span className="pl-3">Teams</span>
      </button>

      <div className="fixed bottom-4 grid justify-items-center gap-2 p-1">
        <img className='pb-2' width="24px" src="./images/_QuestionCircleIcon_.svg" />
        <a className='link text-slate-300 text-sm' target="_blank"
          href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started"
        >
          Read the guide
        </a>
        <a className='link text-slate-300 text-sm' target="_blank"
          href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira.html"
        >
          APM Training
        </a>
        <a className='link text-slate-300 text-sm' target="_blank"
          href="https://www.bitovi.com/services/agile-project-management-consulting"
        >
          Connect with Bitovi
        </a>
      </div>
    </>
  )
};

export default ReportSettings;