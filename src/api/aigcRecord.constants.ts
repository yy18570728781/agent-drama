export const TEAMONES_AIGC_RECORD_PATHS = {
  count: '/api_assets/aigc_record/get_count',
  delete: '/api_assets/aigc_record/delete_record',
  detail: '/api_assets/aigc_record/find',
  list: '/api_assets/aigc_record/get_record_list',
  update: '/api_assets/aigc_record/update_record',
} as const

export const TEAMONES_AIGC_RECORD_FIELDS = [
  'id', 'link_id', 'link_type', 'project_id', 'type', 'prompt', 'param', 'media',
  'status', 'fail_reason', 'endpoint_id', 'is_delete', 'is_favorites', 'created_by', 'created',
].join(',')
