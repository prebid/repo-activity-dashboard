-- github-activity-db schema at migration head 2d2ba76b177c (user_version 2), as alembic upgrade head

-- built it from prebid/github-activity-db 9f0259f6. Tests build activity databases from it.

CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE user_tags (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(500), 
	color VARCHAR(7), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE pr_files (
	pr_id INTEGER NOT NULL, 
	ordinal INTEGER NOT NULL, 
	path TEXT NOT NULL, 
	change_type TEXT NOT NULL, 
	additions INTEGER NOT NULL, 
	deletions INTEGER NOT NULL, 
	PRIMARY KEY (pr_id, ordinal), 
	CONSTRAINT fk_pr_files_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE
);

CREATE TABLE repo_sync_state (
	repository_id INTEGER NOT NULL, 
	last_index_started_at DATETIME, 
	index_pr_total INTEGER, 
	index_issue_total INTEGER, 
	last_success_at DATETIME, 
	last_run_id INTEGER NOT NULL, 
	last_outcome TEXT NOT NULL, 
	halt_reason TEXT, 
	PRIMARY KEY (repository_id), 
	CONSTRAINT fk_repo_sync_state_repository_id_repositories FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE, 
	CONSTRAINT fk_repo_sync_state_last_run_id_sync_runs FOREIGN KEY(last_run_id) REFERENCES sync_runs (id), 
	CONSTRAINT ck_repo_sync_state_last_outcome CHECK (last_outcome IN ('complete', 'time_limited', 'failed', 'incomplete_index', 'halted', 'untracked'))
);

CREATE TABLE sync_pending (
	repository_id INTEGER NOT NULL, 
	item_kind TEXT NOT NULL, 
	number INTEGER NOT NULL, 
	run_id INTEGER NOT NULL, 
	PRIMARY KEY (repository_id, item_kind, number), 
	CONSTRAINT fk_sync_pending_repository_id_repositories FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE, 
	CONSTRAINT fk_sync_pending_run_id_sync_runs FOREIGN KEY(run_id) REFERENCES sync_runs (id), 
	CONSTRAINT ck_sync_pending_item_kind CHECK (item_kind IN ('pull_request', 'issue'))
);

CREATE TABLE pr_user_tags (
	pr_id INTEGER NOT NULL, 
	user_tag_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (pr_id, user_tag_id), 
	CONSTRAINT fk_pr_user_tags_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_user_tags_user_tag_id_user_tags FOREIGN KEY(user_tag_id) REFERENCES user_tags (id) ON DELETE CASCADE
);

CREATE TABLE repositories (
	id INTEGER NOT NULL, 
	github_id BIGINT NOT NULL, 
	node_id TEXT NOT NULL, 
	owner TEXT NOT NULL, 
	name TEXT NOT NULL, 
	full_name TEXT NOT NULL, 
	repo_group TEXT NOT NULL, 
	is_private BOOLEAN NOT NULL, 
	is_archived BOOLEAN NOT NULL, 
	default_branch TEXT NOT NULL, 
	labels_total INTEGER NOT NULL, 
	is_tracked BOOLEAN NOT NULL, 
	resolved_at DATETIME NOT NULL, 
	is_security_policy_enabled BOOLEAN, 
	visibility TEXT NOT NULL, 
	description TEXT, 
	homepage_url TEXT, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	pushed_at DATETIME, 
	archived_at DATETIME, 
	stargazer_count INTEGER NOT NULL, 
	fork_count INTEGER NOT NULL, 
	disk_usage INTEGER, 
	forking_allowed BOOLEAN NOT NULL, 
	allow_update_branch BOOLEAN NOT NULL, 
	web_commit_signoff_required BOOLEAN NOT NULL, 
	has_wiki_enabled BOOLEAN NOT NULL, 
	has_discussions_enabled BOOLEAN NOT NULL, 
	has_projects_enabled BOOLEAN NOT NULL, 
	has_vulnerability_alerts_enabled BOOLEAN NOT NULL, 
	uses_custom_open_graph_image BOOLEAN NOT NULL, 
	merge_commit_allowed BOOLEAN NOT NULL, 
	squash_merge_allowed BOOLEAN NOT NULL, 
	rebase_merge_allowed BOOLEAN NOT NULL, 
	delete_branch_on_merge BOOLEAN NOT NULL, 
	merge_commit_title TEXT NOT NULL, 
	merge_commit_message TEXT NOT NULL, 
	squash_merge_commit_title TEXT NOT NULL, 
	squash_merge_commit_message TEXT NOT NULL, 
	primary_language TEXT, 
	license_spdx_id TEXT, 
	plan_features_codeowners BOOLEAN NOT NULL, 
	plan_features_team_review_requests BOOLEAN NOT NULL, 
	plan_features_maximum_manual_review_requests INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_repositories_github_id UNIQUE (github_id), 
	CONSTRAINT uq_repositories_node_id UNIQUE (node_id)
);

CREATE TABLE repo_labels (
	repository_id INTEGER NOT NULL, 
	node_id TEXT NOT NULL, 
	name TEXT NOT NULL, 
	color TEXT NOT NULL, 
	description TEXT, 
	is_default BOOLEAN NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (repository_id, node_id), 
	CONSTRAINT fk_repo_labels_repository_id_repositories FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE
);

CREATE TABLE github_users (
	id INTEGER NOT NULL, 
	github_id BIGINT, 
	node_id TEXT NOT NULL, 
	login TEXT NOT NULL, 
	type TEXT NOT NULL, 
	name TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	linked_user_github_id BIGINT, 
	claimant_github_id BIGINT, 
	refreshed_at DATETIME NOT NULL, 
	not_found_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_github_users_github_id UNIQUE (github_id), 
	CONSTRAINT uq_github_users_node_id UNIQUE (node_id), 
	CONSTRAINT ck_github_users_type CHECK (type IN ('User', 'Bot', 'Organization', 'Mannequin', 'EnterpriseUserAccount')), 
	CONSTRAINT ck_github_users_github_id_null_iff_enterprise_account CHECK ((github_id IS NULL) = (type = 'EnterpriseUserAccount'))
);

CREATE TABLE account_profiles (
	account_id INTEGER NOT NULL, 
	company TEXT, 
	location TEXT, 
	website_url TEXT, 
	description TEXT, 
	email TEXT, 
	twitter_username TEXT, 
	is_verified BOOLEAN, 
	archived_at DATETIME, 
	has_sponsors_listing BOOLEAN, 
	pinned_items_remaining INTEGER, 
	refreshed_at DATETIME NOT NULL, 
	PRIMARY KEY (account_id), 
	CONSTRAINT fk_account_profiles_account_id_github_users FOREIGN KEY(account_id) REFERENCES github_users (id) ON DELETE CASCADE
);

CREATE TABLE pull_requests (
	id INTEGER NOT NULL, 
	repository_id INTEGER NOT NULL, 
	number INTEGER NOT NULL, 
	github_id BIGINT NOT NULL, 
	node_id TEXT NOT NULL, 
	state TEXT NOT NULL, 
	is_draft BOOLEAN NOT NULL, 
	title TEXT NOT NULL, 
	body TEXT NOT NULL, 
	author_id INTEGER, 
	author_reported BOOLEAN NOT NULL, 
	author_association TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	merged_at DATETIME, 
	closed_at DATETIME, 
	published_at DATETIME, 
	last_edited_at DATETIME, 
	editor_id INTEGER, 
	includes_created_edit BOOLEAN NOT NULL, 
	maintainer_can_modify BOOLEAN NOT NULL, 
	merged_by_id INTEGER, 
	merged_by_reported BOOLEAN NOT NULL, 
	base_ref TEXT NOT NULL, 
	base_ref_oid TEXT NOT NULL, 
	head_ref_name TEXT NOT NULL, 
	head_ref_oid TEXT NOT NULL, 
	head_repo_github_id BIGINT, 
	head_repo_full_name TEXT, 
	head_repo_owner_node_id TEXT, 
	head_repo_owner_login TEXT, 
	merge_commit_oid TEXT, 
	targets_default_branch BOOLEAN NOT NULL, 
	is_cross_repository BOOLEAN NOT NULL, 
	milestone_number INTEGER, 
	milestone_title TEXT, 
	review_decision TEXT, 
	mergeable TEXT NOT NULL, 
	merge_state_status TEXT NOT NULL, 
	can_be_rebased BOOLEAN NOT NULL, 
	potential_merge_commit_oid TEXT, 
	stack_node_id TEXT, 
	stack_number INTEGER, 
	stack_size INTEGER, 
	stack_base_ref_name TEXT, 
	stack_entry_node_id TEXT, 
	stack_position INTEGER, 
	additions INTEGER NOT NULL, 
	deletions INTEGER NOT NULL, 
	changed_files INTEGER NOT NULL, 
	total_comments_count INTEGER, 
	commits_total INTEGER NOT NULL, 
	files_total INTEGER NOT NULL, 
	reviews_total INTEGER NOT NULL, 
	comments_total INTEGER NOT NULL, 
	labels_total INTEGER NOT NULL, 
	closing_issues_total INTEGER NOT NULL, 
	user_linked_closing_issues_total INTEGER NOT NULL, 
	review_requests_total INTEGER NOT NULL, 
	assignees_total INTEGER NOT NULL, 
	github_updated_at DATETIME NOT NULL, 
	hydrated_at DATETIME NOT NULL, 
	hydration_version INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_pull_requests_repository_id_repositories FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pull_requests_author_id_github_users FOREIGN KEY(author_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_pull_requests_editor_id_github_users FOREIGN KEY(editor_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_pull_requests_merged_by_id_github_users FOREIGN KEY(merged_by_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_pull_requests_repository_id_number UNIQUE (repository_id, number), 
	CONSTRAINT uq_pull_requests_github_id UNIQUE (github_id), 
	CONSTRAINT ck_pull_requests_state CHECK (state IN ('OPEN', 'CLOSED', 'MERGED')), 
	CONSTRAINT ck_pull_requests_merged_at_iff_merged CHECK ((state = 'MERGED') = (merged_at IS NOT NULL))
);

CREATE TABLE pr_labels (
	pr_id INTEGER NOT NULL, 
	name TEXT NOT NULL, 
	label_node_id TEXT NOT NULL, 
	PRIMARY KEY (pr_id, name), 
	CONSTRAINT fk_pr_labels_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE
);

CREATE TABLE pr_reviews (
	id INTEGER NOT NULL, 
	github_id BIGINT NOT NULL, 
	node_id TEXT NOT NULL, 
	pr_id INTEGER NOT NULL, 
	reviewer_id INTEGER, 
	reviewer_reported BOOLEAN NOT NULL, 
	state TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	submitted_at DATETIME, 
	published_at DATETIME, 
	updated_at DATETIME NOT NULL, 
	last_edited_at DATETIME, 
	editor_id INTEGER, 
	includes_created_edit BOOLEAN NOT NULL, 
	commit_oid TEXT, 
	author_association TEXT NOT NULL, 
	author_can_push_to_repository BOOLEAN NOT NULL, 
	inline_comments_total INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_pr_reviews_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_reviews_reviewer_id_github_users FOREIGN KEY(reviewer_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_pr_reviews_editor_id_github_users FOREIGN KEY(editor_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_pr_reviews_github_id UNIQUE (github_id), 
	CONSTRAINT ck_pr_reviews_state CHECK (state IN ('APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'))
);

CREATE TABLE pr_comments (
	id INTEGER NOT NULL, 
	github_id BIGINT NOT NULL, 
	node_id TEXT NOT NULL, 
	pr_id INTEGER NOT NULL, 
	author_id INTEGER, 
	author_reported BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	published_at DATETIME, 
	updated_at DATETIME NOT NULL, 
	last_edited_at DATETIME, 
	editor_id INTEGER, 
	created_via_email BOOLEAN NOT NULL, 
	includes_created_edit BOOLEAN NOT NULL, 
	author_association TEXT NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_pr_comments_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_comments_author_id_github_users FOREIGN KEY(author_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_pr_comments_editor_id_github_users FOREIGN KEY(editor_id) REFERENCES github_users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_pr_comments_github_id UNIQUE (github_id)
);

CREATE TABLE pr_commits (
	pr_id INTEGER NOT NULL, 
	sha TEXT NOT NULL, 
	author_id INTEGER, 
	linked_github_id BIGINT, 
	author_name TEXT, 
	author_email TEXT, 
	authored_at DATETIME NOT NULL, 
	PRIMARY KEY (pr_id, sha), 
	CONSTRAINT fk_pr_commits_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_commits_author_id_github_users FOREIGN KEY(author_id) REFERENCES github_users (id) ON DELETE SET NULL
);

CREATE TABLE pr_closing_issues (
	pr_id INTEGER NOT NULL, 
	issue_repo_github_id BIGINT NOT NULL, 
	issue_repo_full_name TEXT NOT NULL, 
	issue_number INTEGER NOT NULL, 
	issue_github_id BIGINT NOT NULL, 
	user_linked BOOLEAN NOT NULL, 
	PRIMARY KEY (pr_id, issue_repo_github_id, issue_number), 
	CONSTRAINT fk_pr_closing_issues_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE
);

CREATE TABLE pr_review_requests (
	pr_id INTEGER NOT NULL, 
	ordinal INTEGER NOT NULL, 
	request_github_id BIGINT, 
	request_node_id TEXT NOT NULL, 
	requested_type TEXT, 
	requested_github_id BIGINT, 
	requested_node_id TEXT, 
	account_id INTEGER, 
	team_slug TEXT, 
	as_code_owner BOOLEAN NOT NULL, 
	PRIMARY KEY (pr_id, ordinal), 
	CONSTRAINT fk_pr_review_requests_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_review_requests_account_id_github_users FOREIGN KEY(account_id) REFERENCES github_users (id) ON DELETE SET NULL
);

CREATE TABLE pr_assignees (
	pr_id INTEGER NOT NULL, 
	account_id INTEGER NOT NULL, 
	PRIMARY KEY (pr_id, account_id), 
	CONSTRAINT fk_pr_assignees_pr_id_pull_requests FOREIGN KEY(pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE, 
	CONSTRAINT fk_pr_assignees_account_id_github_users FOREIGN KEY(account_id) REFERENCES github_users (id) ON DELETE CASCADE
);

CREATE TABLE sync_runs (
	id INTEGER NOT NULL, 
	started_at DATETIME NOT NULL, 
	deadline_at DATETIME, 
	finished_at DATETIME, 
	status TEXT NOT NULL, 
	exit_code INTEGER, 
	"trigger" TEXT NOT NULL, 
	code_version TEXT NOT NULL, 
	config_source TEXT NOT NULL, 
	config_sha256 TEXT NOT NULL, 
	graphql_points INTEGER NOT NULL, 
	rest_calls INTEGER NOT NULL, 
	items_planned INTEGER NOT NULL, 
	items_hydrated INTEGER NOT NULL, 
	items_deleted INTEGER NOT NULL, 
	failures INTEGER NOT NULL, 
	deletions_approved TEXT, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_sync_runs_status CHECK (status IN ('running', 'complete', 'time_limited', 'failed', 'aborted')), 
	CONSTRAINT ck_sync_runs_trigger CHECK ("trigger" IN ('schedule', 'workflow_dispatch', 'manual'))
);

CREATE TABLE automation_accounts (
	id INTEGER NOT NULL, 
	github_id BIGINT NOT NULL, 
	login TEXT NOT NULL, 
	reason TEXT NOT NULL, 
	run_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_automation_accounts_run_id_sync_runs FOREIGN KEY(run_id) REFERENCES sync_runs (id), 
	CONSTRAINT uq_automation_accounts_github_id UNIQUE (github_id)
);

CREATE TABLE automation_emails (
	id INTEGER NOT NULL, 
	email TEXT NOT NULL, 
	reason TEXT NOT NULL, 
	run_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_automation_emails_run_id_sync_runs FOREIGN KEY(run_id) REFERENCES sync_runs (id), 
	CONSTRAINT uq_automation_emails_email UNIQUE (email), 
	CONSTRAINT ck_automation_emails_email_lowercase CHECK (email = lower(email)), 
	CONSTRAINT ck_automation_emails_email_ascii CHECK (email NOT GLOB '*[^ -~]*')
);

CREATE TABLE sync_failures (
	id INTEGER NOT NULL, 
	repository_id INTEGER NOT NULL, 
	item_kind TEXT NOT NULL, 
	number INTEGER NOT NULL, 
	attempts INTEGER NOT NULL, 
	last_error TEXT NOT NULL, 
	first_failed_at DATETIME NOT NULL, 
	last_failed_at DATETIME NOT NULL, 
	last_run_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT fk_sync_failures_repository_id_repositories FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE, 
	CONSTRAINT fk_sync_failures_last_run_id_sync_runs FOREIGN KEY(last_run_id) REFERENCES sync_runs (id), 
	CONSTRAINT uq_sync_failures_repository_id_item_kind_number UNIQUE (repository_id, item_kind, number), 
	CONSTRAINT ck_sync_failures_item_kind CHECK (item_kind IN ('pull_request', 'issue'))
);

CREATE INDEX ix_repo_sync_state_last_run_id ON repo_sync_state (last_run_id);

CREATE INDEX ix_sync_pending_run_id ON sync_pending (run_id);

CREATE INDEX ix_repositories_full_name ON repositories (full_name);

CREATE INDEX ix_pull_requests_repository_id_state ON pull_requests (repository_id, state);

CREATE INDEX ix_pull_requests_repository_id_merged_at ON pull_requests (repository_id, merged_at);

CREATE INDEX ix_pull_requests_author_id ON pull_requests (author_id);

CREATE INDEX ix_pull_requests_merged_by_id ON pull_requests (merged_by_id);

CREATE INDEX ix_pull_requests_editor_id ON pull_requests (editor_id);

CREATE INDEX ix_pull_requests_merge_commit_oid ON pull_requests (merge_commit_oid);

CREATE INDEX ix_pr_reviews_pr_id_reviewer_id_github_id ON pr_reviews (pr_id, reviewer_id, github_id);

CREATE INDEX ix_pr_reviews_reviewer_id ON pr_reviews (reviewer_id);

CREATE INDEX ix_pr_reviews_editor_id ON pr_reviews (editor_id);

CREATE INDEX ix_pr_comments_pr_id_author_id ON pr_comments (pr_id, author_id);

CREATE INDEX ix_pr_comments_author_id ON pr_comments (author_id);

CREATE INDEX ix_pr_comments_editor_id ON pr_comments (editor_id);

CREATE INDEX ix_pr_commits_author_id ON pr_commits (author_id);

CREATE INDEX ix_pr_closing_issues_issue_repo_github_id_issue_number ON pr_closing_issues (issue_repo_github_id, issue_number);

CREATE INDEX ix_pr_review_requests_account_id ON pr_review_requests (account_id);

CREATE INDEX ix_pr_assignees_account_id ON pr_assignees (account_id);

CREATE INDEX ix_automation_accounts_run_id ON automation_accounts (run_id);

CREATE INDEX ix_automation_emails_run_id ON automation_emails (run_id);

CREATE INDEX ix_sync_failures_last_run_id ON sync_failures (last_run_id);

CREATE VIEW v_github_users AS
SELECT
    u.github_id AS github_id,
    u.node_id AS node_id,
    u.login AS login,
    u.type AS type,
    u.name AS name,
    u.created_at AS created_at,
    u.updated_at AS updated_at,
    u.linked_user_github_id AS linked_user_github_id,
    u.claimant_github_id AS claimant_github_id,
    u.refreshed_at AS refreshed_at,
    u.not_found_at AS not_found_at,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = u.github_id)
        AS automation_reason
FROM github_users AS u;

CREATE VIEW v_account_profiles AS
SELECT
    u.github_id AS github_id,
    u.node_id AS node_id,
    u.login AS login,
    u.type AS type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = u.github_id)
        AS automation_reason,
    p.company AS company,
    p.location AS location,
    p.website_url AS website_url,
    p.description AS description,
    p.email AS email,
    p.twitter_username AS twitter_username,
    p.is_verified AS is_verified,
    p.archived_at AS archived_at,
    p.has_sponsors_listing AS has_sponsors_listing,
    p.pinned_items_remaining AS pinned_items_remaining,
    p.refreshed_at AS refreshed_at
FROM account_profiles AS p
JOIN github_users AS u ON u.id = p.account_id;

CREATE VIEW v_pr_reviews AS
SELECT
    repo.github_id AS repository_github_id,
    repo.full_name AS repository_full_name,
    repo.is_tracked AS repository_is_tracked,
    p.number AS pr_number,
    p.github_id AS pr_github_id,
    r.github_id AS review_github_id,
    r.node_id AS review_node_id,
    r.state AS state,
    r.created_at AS created_at,
    r.submitted_at AS submitted_at,
    r.published_at AS published_at,
    r.updated_at AS updated_at,
    r.last_edited_at AS last_edited_at,
    r.includes_created_edit AS includes_created_edit,
    r.commit_oid AS commit_oid,
    r.author_association AS author_association,
    r.author_can_push_to_repository AS author_can_push_to_repository,
    r.inline_comments_total AS inline_comments_total,
    r.reviewer_reported AS reviewer_reported,
    reviewer.github_id AS reviewer_github_id,
    reviewer.node_id AS reviewer_node_id,
    reviewer.login AS reviewer_login,
    reviewer.type AS reviewer_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = reviewer.github_id)
        AS reviewer_automation_reason,
    editor.github_id AS editor_github_id,
    editor.node_id AS editor_node_id,
    editor.login AS editor_login,
    editor.type AS editor_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = editor.github_id)
        AS editor_automation_reason,
    CASE
        WHEN r.reviewer_id IS NULL OR p.author_id IS NULL THEN NULL
        WHEN r.reviewer_id = p.author_id THEN 1
        ELSE 0
    END AS is_pr_author
FROM pr_reviews AS r
JOIN pull_requests AS p ON p.id = r.pr_id
JOIN repositories AS repo ON repo.id = p.repository_id
LEFT JOIN github_users AS reviewer ON reviewer.id = r.reviewer_id
LEFT JOIN github_users AS editor ON editor.id = r.editor_id;

CREATE VIEW v_pr_comments AS
SELECT
    repo.github_id AS repository_github_id,
    repo.full_name AS repository_full_name,
    repo.is_tracked AS repository_is_tracked,
    p.number AS pr_number,
    p.github_id AS pr_github_id,
    c.github_id AS comment_github_id,
    c.node_id AS comment_node_id,
    c.created_at AS created_at,
    c.published_at AS published_at,
    c.updated_at AS updated_at,
    c.last_edited_at AS last_edited_at,
    c.created_via_email AS created_via_email,
    c.includes_created_edit AS includes_created_edit,
    c.author_association AS author_association,
    c.author_reported AS author_reported,
    author.github_id AS author_github_id,
    author.node_id AS author_node_id,
    author.login AS author_login,
    author.type AS author_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = author.github_id)
        AS author_automation_reason,
    editor.github_id AS editor_github_id,
    editor.node_id AS editor_node_id,
    editor.login AS editor_login,
    editor.type AS editor_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = editor.github_id)
        AS editor_automation_reason,
    CASE
        WHEN c.author_id IS NULL OR p.author_id IS NULL THEN NULL
        WHEN c.author_id = p.author_id THEN 1
        ELSE 0
    END AS is_pr_author,
    CASE
        WHEN c.author_id IS NULL THEN NULL
        WHEN EXISTS (
            SELECT 1 FROM pr_reviews AS r WHERE r.pr_id = c.pr_id AND r.reviewer_id = c.author_id
        ) THEN 1
        ELSE 0
    END AS author_also_reviewed
FROM pr_comments AS c
JOIN pull_requests AS p ON p.id = c.pr_id
JOIN repositories AS repo ON repo.id = p.repository_id
LEFT JOIN github_users AS author ON author.id = c.author_id
LEFT JOIN github_users AS editor ON editor.id = c.editor_id;

CREATE VIEW v_commit_authors AS
SELECT
    repo.github_id AS repository_github_id,
    repo.full_name AS repository_full_name,
    repo.is_tracked AS repository_is_tracked,
    p.number AS pr_number,
    p.github_id AS pr_github_id,
    c.sha AS sha,
    c.linked_github_id AS linked_github_id,
    c.author_name AS author_name,
    c.author_email AS author_email,
    c.authored_at AS authored_at,
    account.github_id AS account_github_id,
    account.node_id AS account_node_id,
    account.login AS account_login,
    account.type AS account_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = account.github_id)
        AS account_automation_reason,
    (SELECT e.reason FROM automation_emails AS e WHERE e.email = lower(c.author_email))
        AS email_automation_reason
FROM pr_commits AS c
JOIN pull_requests AS p ON p.id = c.pr_id
JOIN repositories AS repo ON repo.id = p.repository_id
LEFT JOIN github_users AS account ON account.id = c.author_id;

CREATE VIEW v_pr_relationships AS
SELECT
    repo.github_id AS repository_github_id,
    repo.full_name AS repository_full_name,
    repo.is_tracked AS repository_is_tracked,
    p.number AS pr_number,
    p.github_id AS pr_github_id,
    rel.relationship AS relationship,
    rel.review_github_id AS review_github_id,
    rel.comment_github_id AS comment_github_id,
    rel.request_node_id AS request_node_id,
    rel.request_github_id AS request_github_id,
    rel.request_ordinal AS request_ordinal,
    rel.commit_sha AS commit_sha,
    rel.reported AS reported,
    account.github_id AS account_github_id,
    account.node_id AS account_node_id,
    account.login AS account_login,
    account.type AS account_type,
    (SELECT a.reason FROM automation_accounts AS a WHERE a.github_id = account.github_id)
        AS account_automation_reason,
    account.not_found_at AS account_not_found_at,
    rel.review_state AS review_state,
    rel.review_submitted_at AS review_submitted_at,
    rel.requested_type AS requested_type,
    rel.requested_github_id AS requested_github_id,
    rel.team_slug AS team_slug,
    rel.as_code_owner AS as_code_owner,
    rel.linked_github_id AS linked_github_id,
    rel.author_name AS author_name,
    rel.author_email AS author_email,
    (SELECT e.reason FROM automation_emails AS e WHERE e.email = lower(rel.author_email))
        AS email_automation_reason,
    p.state AS pr_state,
    p.created_at AS pr_created_at,
    p.merged_at AS pr_merged_at,
    p.closed_at AS pr_closed_at,
    p.base_ref AS base_ref,
    p.targets_default_branch AS targets_default_branch,
    p.merge_commit_oid AS merge_commit_oid,
    p.additions AS additions,
    p.deletions AS deletions,
    p.changed_files AS changed_files
FROM (
    SELECT
        pr.id AS pr_id,
        'author' AS relationship,
        NULL AS review_github_id,
        NULL AS comment_github_id,
        NULL AS request_node_id,
        NULL AS request_github_id,
        NULL AS request_ordinal,
        NULL AS commit_sha,
        pr.author_reported AS reported,
        pr.author_id AS account_id,
        NULL AS review_state,
        NULL AS review_submitted_at,
        NULL AS requested_type,
        NULL AS requested_github_id,
        NULL AS team_slug,
        NULL AS as_code_owner,
        NULL AS linked_github_id,
        NULL AS author_name,
        NULL AS author_email
    FROM pull_requests AS pr
    UNION ALL
    SELECT
        pr.id, 'merged_by', NULL, NULL, NULL, NULL, NULL, NULL, pr.merged_by_reported,
        pr.merged_by_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pull_requests AS pr
    WHERE pr.state = 'MERGED'
    UNION ALL
    SELECT
        r.pr_id, 'review', r.github_id, NULL, NULL, NULL, NULL, NULL, r.reviewer_reported,
        r.reviewer_id, r.state, r.submitted_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pr_reviews AS r
    UNION ALL
    SELECT
        c.pr_id, 'comment', NULL, c.github_id, NULL, NULL, NULL, NULL, c.author_reported,
        c.author_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pr_comments AS c
    UNION ALL
    SELECT
        q.pr_id, 'review_request', NULL, NULL, q.request_node_id, q.request_github_id,
        q.ordinal, NULL, NULL, q.account_id, NULL, NULL, q.requested_type,
        q.requested_github_id, q.team_slug, q.as_code_owner, NULL, NULL, NULL
    FROM pr_review_requests AS q
    UNION ALL
    SELECT
        s.pr_id, 'assignee', NULL, NULL, NULL, NULL, NULL, NULL, NULL, s.account_id, NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pr_assignees AS s
    UNION ALL
    SELECT
        m.pr_id, 'commit_author', NULL, NULL, NULL, NULL, NULL, m.sha, NULL, m.author_id, NULL,
        NULL, NULL, NULL, NULL, NULL, m.linked_github_id, m.author_name, m.author_email
    FROM pr_commits AS m
    UNION ALL
    SELECT
        pr.id, 'pr_editor', NULL, NULL, NULL, NULL, NULL, NULL, NULL, pr.editor_id, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pull_requests AS pr
    WHERE pr.editor_id IS NOT NULL OR pr.last_edited_at IS NOT NULL
    UNION ALL
    SELECT
        r.pr_id, 'review_editor', r.github_id, NULL, NULL, NULL, NULL, NULL, NULL, r.editor_id,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pr_reviews AS r
    WHERE r.editor_id IS NOT NULL OR r.last_edited_at IS NOT NULL
    UNION ALL
    SELECT
        c.pr_id, 'comment_editor', NULL, c.github_id, NULL, NULL, NULL, NULL, NULL, c.editor_id,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM pr_comments AS c
    WHERE c.editor_id IS NOT NULL OR c.last_edited_at IS NOT NULL
) AS rel
JOIN pull_requests AS p ON p.id = rel.pr_id
JOIN repositories AS repo ON repo.id = p.repository_id
LEFT JOIN github_users AS account ON account.id = rel.account_id;

PRAGMA user_version = 2;
