<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import SubjectDetailEditor from '@/components/subjects/SubjectDetailEditor.vue'

const router = useRouter()
const route = useRoute()
const subjectId = String(route.params.id || '')

function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/subjects')
}
</script>

<template>
  <SubjectDetailEditor :subject-id="subjectId" @back="goBack" @deleted="goBack" />
</template>
