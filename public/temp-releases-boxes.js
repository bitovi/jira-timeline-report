{{# for(release of this.releases) }}
	<div class='release_box'>
		<div class="release_box_header_bubble color-text-and-bg-{{release.status}}">{{release.shortName}}</div>
		<div class="release_box_subtitle">
			{{# if(not(eq(release.release, "Next")))}}
				{{# if(this.showExtraTimings) }}
				<div class="release_box_subtitle_wrapper">
						<span class="release_box_subtitle_key color-text-and-bg-{{release.devStatus}}">Dev</span>
						<span class="release_box_subtitle_value">
							{{ this.prettyDate(release.dev.due) }}{{this.wasReleaseDate(release.dev)}}
						</span>
				</div>
				<div class="release_box_subtitle_wrapper">
						<span class="release_box_subtitle_key color-text-and-bg-{{release.qaStatus}}">QA&nbsp;</span>
						<span class="release_box_subtitle_value">
							{{ this.prettyDate(release.qa.due) }}{{this.wasReleaseDate(release.qa)}}
						</span>
				</div>
				<div class="release_box_subtitle_wrapper">
						<span class="release_box_subtitle_key color-text-and-bg-{{release.uatStatus}}">UAT</span>
						<span class="release_box_subtitle_value">
							{{ this.prettyDate(release.uat.due) }}{{this.wasReleaseDate(release.uat)}}
						</span>
				</div>
				{{ else }}
				<div class="release_box_subtitle_wrapper">
						<b>Target Delivery</b>
						<span class="release_box_subtitle_value">
							{{ this.prettyDate(release.uat.due) }}{{this.wasReleaseDate(release.uat)}}
						</span>
				</div>
				{{/ if }}

			{{/ if }}
		</div>
		<ul class="release_box_body">
			{{# for(initiative of release.initiatives) }}
			 <li class='font-sans text-sm {{# unless(this.showExtraTimings) }} color-text-{{initiative.status}} {{/ }}'>
				{{# if(this.showExtraTimings) }}
				<span class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.devStatus}}'>D</span><span
					class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.qaStatus}}'>Q</span><span
					class='text-xs font-mono px-1px py-0px color-text-and-bg-{{initiative.uatStatus}}'>U</span>
				{{/ if }}
				{{initiative.Summary}}
			 </li>
			{{/ for}}
		</ul>
	</div>
{{ else }}
<div class='release_box'>
	<div class="release_box_header_bubble">
		Unable to find any initiatives with releases.
	</div>
</div>
{{/ for }}
